import { useRef, useState } from "react";
import { Link } from "react-router";
import {
  ResourceContextProvider,
  useDataProvider,
  useGetIdentity,
  useGetList,
  useNotify,
  useRecordContext,
  useTranslate,
} from "ra-core";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Task } from "../tasks/Task";
import { useConfigurationContext } from "../root/ConfigurationContext";
import type { Contact, Task as TaskRecord } from "../types";
import type { Recruitment } from "./model";
import { createRecruitmentTask, followUpText } from "./followUp";

export const RecruitmentFollowUp = ({
  record: supplied,
}: {
  record?: Recruitment;
}) => {
  const context = useRecordContext<Recruitment>();
  const record = supplied ?? context;
  return record ? <FollowUpContent key={record.id} record={record} /> : null;
};

const FollowUpContent = ({ record }: { record: Recruitment }) => {
  const provider = useDataProvider();
  const notify = useNotify();
  const translate = useTranslate();
  const queryClient = useQueryClient();
  const { identity } = useGetIdentity();
  const { taskTypes } = useConfigurationContext();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const locked = useRef(false);
  const {
    data: tasks,
    isPending,
    error,
    refetch,
  } = useGetList<TaskRecord>("tasks", {
    filter: { recruitment_id: record.id },
    pagination: { page: 1, perPage: 100 },
    sort: { field: "id", order: "DESC" },
  });
  const {
    data: contacts,
    isPending: loadingContacts,
    error: contactsError,
  } = useGetList<Contact>("contacts", {
    filter: { company_id: record.company_id },
    pagination: { page: 1, perPage: 1000 },
    sort: { field: "first_name", order: "ASC" },
  });
  const hasOpenTask = tasks?.some((task) => !task.done_date);
  const save = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (locked.current || !identity) return;
    locked.current = true;
    setSaving(true);
    const fields = new FormData(event.currentTarget);
    try {
      await createRecruitmentTask(provider, record, {
        contact_id: String(fields.get("contact_id")),
        sales_id: identity.id,
        text: String(fields.get("text")),
        due_date: String(fields.get("due_date")),
        type: String(fields.get("type")),
      });
      setOpen(false);
      notify("跟进任务已创建，可在工作台和联系人详情中查看。", {
        type: "success",
      });
      void queryClient.invalidateQueries({ queryKey: ["tasks"] });
      void queryClient.invalidateQueries({ queryKey: ["contacts"] });
      void queryClient.invalidateQueries({ queryKey: ["contacts_summary"] });
    } catch (cause) {
      const message =
        cause instanceof Error ? cause.message : "创建失败，请检查网络后重试。";
      notify(
        message.includes("tasks_one_open_recruitment")
          ? "该线索已有未完成的任务，请刷新后查看。"
          : message,
        { type: "error" },
      );
      void refetch();
    } finally {
      locked.current = false;
      setSaving(false);
    }
  };
  return (
    <section
      className="my-6 space-y-4 rounded-lg border p-4"
      aria-label="招聘线索跟进任务"
    >
      <h2 className="text-lg font-semibold">客户与跟进任务</h2>
      <p className="text-sm text-muted-foreground">
        任务关联该公司的联系人，由当前用户负责。创建或完成任务不会自动将线索标记为已联系；请根据实际沟通结果更新推广状态。
      </p>
      <div className="flex flex-wrap gap-3">
        <Button asChild variant="outline">
          <Link to={`/companies/${record.company_id}/show`}>查看公司客户</Link>
        </Button>
        <Button
          type="button"
          onClick={() => setOpen(true)}
          disabled={
            !identity ||
            isPending ||
            !!error ||
            loadingContacts ||
            !!contactsError ||
            !contacts?.length ||
            hasOpenTask
          }
        >
          创建跟进任务
        </Button>
        <Button asChild variant="outline">
          <Link
            to="/contacts/create"
            state={{
              recruitmentReturnId: record.id,
              record: {
                company_id: record.company_id,
                ...(record.email_verified && record.business_email
                  ? {
                      email_jsonb: [
                        { email: record.business_email, type: "Work" },
                      ],
                    }
                  : {}),
              },
            }}
          >
            新增该公司联系人
          </Link>
        </Button>
      </div>
      {loadingContacts ? (
        <p>正在加载联系人…</p>
      ) : contactsError ? (
        <p role="alert">联系人加载失败，请刷新页面重试。</p>
      ) : !contacts?.length ? (
        <p>该公司还没有联系人，请先新增联系人，再创建跟进任务。</p>
      ) : null}
      {isPending ? (
        <p>正在加载跟进任务…</p>
      ) : error ? (
        <p role="alert">
          任务加载失败。
          <Button variant="link" onClick={() => void refetch()}>
            重试
          </Button>
        </p>
      ) : (
        <ResourceContextProvider value="tasks">
          {hasOpenTask && (
            <p className="text-sm">已有未完成任务，完成后可安排下一次跟进。</p>
          )}
          {!tasks?.length && (
            <p className="text-muted-foreground">尚未安排跟进任务。</p>
          )}
          {tasks?.map((task) => (
            <div key={task.id} className="border-t py-3">
              <Task task={task} showContact />
            </div>
          ))}
        </ResourceContextProvider>
      )}
      <Dialog
        open={open}
        onOpenChange={(next) => {
          if (!saving) setOpen(next);
        }}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>创建招聘线索跟进任务</DialogTitle>
            <DialogDescription>
              需求背景已填入，可修改后保存。此操作只创建任务，不发送邮件。
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={save} className="space-y-4">
            <label className="block space-y-2">
              <span>联系人</span>
              <select
                name="contact_id"
                required
                className="w-full rounded-md border p-2"
                defaultValue={
                  contacts?.length === 1 ? String(contacts[0].id) : ""
                }
              >
                <option value="" disabled>
                  请选择该公司联系人
                </option>
                {contacts?.map((contact) => (
                  <option key={contact.id} value={contact.id}>
                    {contact.first_name} {contact.last_name}
                  </option>
                ))}
              </select>
            </label>
            <label className="block space-y-2">
              <span>跟进内容</span>
              <Textarea
                name="text"
                required
                rows={8}
                defaultValue={followUpText(record)}
              />
            </label>
            <label className="block space-y-2">
              <span>截止时间</span>
              <Input name="due_date" type="datetime-local" required />
            </label>
            <label className="block space-y-2">
              <span>跟进类型</span>
              <select
                name="type"
                required
                className="w-full rounded-md border p-2"
                defaultValue="none"
              >
                {taskTypes.map((type) => (
                  <option key={type.value} value={type.value}>
                    {translate(type.label, { _: type.label })}
                  </option>
                ))}
              </select>
            </label>
            <Button type="submit" disabled={saving}>
              {saving ? "正在保存…" : "保存跟进任务"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </section>
  );
};
