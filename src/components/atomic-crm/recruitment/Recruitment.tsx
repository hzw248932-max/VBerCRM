import {
  CreateBase,
  EditBase,
  Form,
  email,
  required,
  useGetList,
  useRecordContext,
  useNotify,
  useDataProvider,
  useListContext,
  useCanAccess,
  type Identifier,
} from "ra-core";
import { Link } from "react-router";
import { RecruitmentFollowUp } from "./RecruitmentFollowUp";
import { ArrayInput } from "@/components/admin/array-input";
import { AutocompleteInput } from "@/components/admin/autocomplete-input";
import { BooleanInput } from "@/components/admin/boolean-input";
import { CreateButton } from "@/components/admin/create-button";
import { DataTable } from "@/components/admin/data-table";
import { SaveButton } from "@/components/admin/form";
import { List } from "@/components/admin/list";
import { ListPagination } from "@/components/admin/list-pagination";
import { NumberInput } from "@/components/admin/number-input";
import { ReferenceField } from "@/components/admin/reference-field";
import { ReferenceInput } from "@/components/admin/reference-input";
import { SelectInput } from "@/components/admin/select-input";
import { SimpleFormIterator } from "@/components/admin/simple-form-iterator";
import { TextInput } from "@/components/admin/text-input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { Company } from "../types";
import {
  safeUrl,
  statuses,
  validateRecruitment,
  validateUrl,
  type Recruitment,
} from "./model";

const companyFilter = (q: string) => ({ "name@ilike": `%${q}%` });
const CompanyName = () => {
  const record = useRecordContext<Company>();
  return <span>{record?.name}</span>;
};
const CompanyWebsite = () => {
  const record = useRecordContext<Company>();
  const href = safeUrl(record?.website);
  return href ? (
    <a
      className="underline"
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      onClick={(event) => event.stopPropagation()}
    >
      公司官网 ↗
    </a>
  ) : (
    <span>未填写</span>
  );
};
const Evidence = () => {
  const record = useRecordContext<Recruitment>();
  return (
    <div className="min-w-52 space-y-2">
      {record?.jobs?.length
        ? record.jobs.map((job, index) => (
            <div key={index}>
              {safeUrl(job.url) ? (
                <a
                  className="underline"
                  href={safeUrl(job.url)}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(event) => event.stopPropagation()}
                >
                  {job.title} ↗
                </a>
              ) : (
                <span>{job.title}</span>
              )}
              <p className="text-xs text-muted-foreground">
                {job.keywords || "尚未记录关键词"}
              </p>
            </div>
          ))
        : "尚未添加岗位"}
    </div>
  );
};
const Status = () => {
  const record = useRecordContext<Recruitment>();
  return (
    <span className="whitespace-nowrap rounded-full bg-secondary px-3 py-1">
      {statuses.find((item) => item.id === record?.status)?.name}
    </span>
  );
};
const Email = () => {
  const record = useRecordContext<Recruitment>();
  return (
    <div>
      {record?.business_email || "未填写"}
      <p className="text-xs text-muted-foreground">
        {record?.email_verified ? "已核实公开来源" : "尚未核实"}
      </p>
    </div>
  );
};

const RecruitmentPagination = () => {
  const { total, isPending } = useListContext();
  return isPending || !total ? null : <ListPagination />;
};

export const RecruitmentList = () => (
  <div className="p-4 pb-24 md:pb-6">
    <h1 className="text-2xl font-semibold">招聘信号筛选表</h1>
    <p className="text-muted-foreground my-3">
      以公司为潜在客户，将多个招聘岗位汇总为需求证据。优先研究匹配度高的公司。
    </p>
    <List
      title={false}
      exporter={false}
      perPage={25}
      pagination={<RecruitmentPagination />}
      sort={{ field: "score", order: "DESC" }}
      actions={<CreateButton label="添加公司招聘信号" />}
      filters={[
        <ReferenceInput
          key="company"
          source="company_id"
          reference="companies"
          alwaysOn
        >
          <AutocompleteInput
            label="公司名称"
            optionText="name"
            filterToQuery={companyFilter}
          />
        </ReferenceInput>,
        <SelectInput
          key="status"
          source="status"
          label="推广状态"
          choices={statuses}
          alwaysOn
        />,
        <NumberInput
          key="score"
          source="score@gte"
          label="最低匹配评分"
          min={1}
          max={5}
          alwaysOn
        />,
      ]}
    >
      <div className="overflow-x-auto">
        <DataTable
          rowClick="edit"
          bulkActionButtons={false}
          empty={
            <div className="rounded-xl border border-dashed p-10 text-center">
              <h2 className="font-semibold">暂无符合条件的招聘信号</h2>
              <p className="text-muted-foreground mt-2">
                添加公司的招聘岗位证据，或调整上方筛选条件。
              </p>
            </div>
          }
        >
          <DataTable.Col label="公司名称" disableSort>
            <ReferenceField
              source="company_id"
              reference="companies"
              link="show"
            >
              <CompanyName />
            </ReferenceField>
          </DataTable.Col>
          <DataTable.Col label="招聘岗位 / 链接 / 关键词" disableSort>
            <Evidence />
          </DataTable.Col>
          <DataTable.Col source="pain_points" label="可能的工作痛点" />
          <DataTable.Col source="matched_features" label="VBerAI 匹配功能" />
          <DataTable.Col source="score" label="匹配评分（1–5）" />
          <DataTable.Col label="公司官网" disableSort>
            <ReferenceField
              source="company_id"
              reference="companies"
              link={false}
            >
              <CompanyWebsite />
            </ReferenceField>
          </DataTable.Col>
          <DataTable.Col label="商务联系邮箱" disableSort>
            <Email />
          </DataTable.Col>
          <DataTable.Col source="status" label="推广状态">
            <Status />
          </DataTable.Col>
          <DataTable.Col
            label="跟进"
            disableSort
            render={(record) => (
              <Link
                className="underline whitespace-nowrap"
                to={`/recruitment/${record.id}`}
                onClick={(event) => event.stopPropagation()}
              >
                安排 / 查看跟进
              </Link>
            )}
          />
        </DataTable>
      </div>
    </List>
  </div>
);

const Inputs = ({ editing = false }: { editing?: boolean }) => (
  <>
    {editing ? (
      <div className="mb-4">
        <ReferenceField source="company_id" reference="companies" link="show">
          <CompanyName />
        </ReferenceField>
      </div>
    ) : (
      <ReferenceInput source="company_id" reference="companies">
        <AutocompleteInput
          label="公司名称"
          optionText="name"
          filterToQuery={companyFilter}
          validate={required()}
          helperText="先选择已有公司；同一家公司只建一条筛选记录。"
        />
      </ReferenceInput>
    )}
    {!editing && (
      <Link className="text-sm underline" to="/companies/create">
        公司尚未建档？先新建公司
      </Link>
    )}
    <div className="grid gap-4 md:grid-cols-2 mt-4">
      <SelectInput
        source="status"
        label="推广状态"
        choices={statuses}
        validate={required()}
      />
      <NumberInput
        source="score"
        label="匹配评分（1–5）"
        min={1}
        max={5}
        step={1}
        helperText="1 = 关联弱；3 = 有明确需求；5 = 高度匹配。未评估可留空。"
      />
      <TextInput
        source="pain_points"
        label="可能的工作痛点"
        multiline
        helperText="例如：大量重复制作 UI 变体。请区分招聘事实与分析推测。"
      />
      <TextInput
        source="matched_features"
        label="VBerAI 匹配功能"
        multiline
        helperText="例如：图层换皮、UI 拆分。"
      />
      <TextInput
        source="business_email"
        label="商务联系邮箱"
        type="email"
        validate={email()}
      />
      <TextInput
        source="email_source"
        label="邮箱公开来源链接"
        validate={validateUrl}
        helperText="保留官网联系页等核实依据。"
      />
      <BooleanInput source="email_verified" label="已核实为公开商务邮箱" />
    </div>
    <h2 className="text-lg font-semibold my-3">招聘岗位证据</h2>
    <ArrayInput source="jobs" label="同一公司可添加多个岗位">
      <SimpleFormIterator
        disableReordering
        getItemLabel={(index) => `岗位 ${index + 1}`}
      >
        <TextInput source="title" label="招聘岗位" validate={required()} />
        <TextInput
          source="url"
          label="职位链接"
          validate={[required(), validateUrl]}
        />
        <TextInput
          source="keywords"
          label="招聘关键词"
          helperText="例如：活动 UI、图标、换皮"
        />
      </SimpleFormIterator>
    </ArrayInput>
    <div className="flex justify-end gap-3 mt-6">
      <Button variant="outline" asChild>
        <Link to="/recruitment">返回列表</Link>
      </Button>
      <SaveButton label="保存招聘信号" />
    </div>
  </>
);
const errorMessage = (error: { message?: string }) =>
  error.message?.includes("recruitment_company_id_key")
    ? "该公司已有招聘筛选记录，请返回列表编辑，避免重复建档。"
    : "保存失败，请检查填写内容和网络连接后重试。";

export const RecruitmentCreate = () => {
  const notify = useNotify();
  const provider = useDataProvider();
  const validate = async (values: Partial<Recruitment>) => {
    const errors = validateRecruitment(values);
    if (values.company_id) {
      try {
        const { data } = await provider.getList("recruitment", {
          filter: { company_id: values.company_id },
          pagination: { page: 1, perPage: 1 },
          sort: { field: "id", order: "ASC" },
        });
        if (data.length)
          errors.company_id = "该公司已有招聘筛选记录，请返回列表编辑。";
      } catch {
        errors.company_id = "暂时无法检查公司记录，请稍后重试。";
      }
    }
    return errors;
  };
  return (
    <CreateBase
      redirect="list"
      mutationOptions={{
        onError: (error: Error) =>
          notify(errorMessage(error), { type: "error" }),
      }}
    >
      <div className="max-w-4xl mx-auto p-4 pb-24">
        <h1 className="text-2xl font-semibold mb-4">添加公司招聘信号</h1>
        <Card>
          <CardContent>
            <Form
              defaultValues={{
                status: "research",
                jobs: [],
                email_verified: false,
              }}
              validate={validate}
            >
              <Inputs />
            </Form>
          </CardContent>
        </Card>
      </div>
    </CreateBase>
  );
};
export const RecruitmentEdit = () => (
  <EditBase mutationMode="pessimistic" redirect="list" disableAccessControl>
    <div className="max-w-4xl mx-auto p-4 pb-24">
      <h1 className="text-2xl font-semibold mb-4">编辑招聘信号</h1>
      <RecruitmentFollowUp />
      <Card>
        <CardContent>
          <Form validate={validateRecruitment}>
            <RecruitmentEditInputs />
          </Form>
        </CardContent>
      </Card>
    </div>
  </EditBase>
);

const RecruitmentEditInputs = () => {
  const record = useRecordContext();
  const { canAccess } = useCanAccess({
    resource: "recruitment",
    action: "edit",
    record,
  });
  return (
    <>
      {!canAccess && (
        <p className="mb-4 text-muted-foreground">
          只读：仅公司负责人和管理员可修改招聘信号。
        </p>
      )}
      <fieldset disabled={!canAccess}>
        <Inputs editing />
      </fieldset>
    </>
  );
};

export const CompanyRecruitment = ({
  companyId,
}: {
  companyId: Identifier;
}) => {
  const { data, isPending, error } = useGetList<Recruitment>("recruitment", {
    filter: { company_id: companyId },
    pagination: { page: 1, perPage: 1 },
    sort: { field: "id", order: "ASC" },
  });
  if (isPending) return <p>正在加载招聘信号…</p>;
  if (error) return <p role="alert">招聘信号加载失败，请刷新后重试。</p>;
  const record = data?.[0];
  return (
    <div className="space-y-3 py-4">
      <h2 className="font-semibold">招聘信号与需求证据</h2>
      {record ? (
        <>
          <p>
            {statuses.find((item) => item.id === record.status)?.name} ·
            匹配评分：{record.score ?? "未评估"} · {record.jobs.length} 个岗位
          </p>
          <p>{record.pain_points || "尚未分析工作痛点"}</p>
        </>
      ) : (
        <p className="text-muted-foreground">
          尚未记录招聘信号。多个岗位会归入同一家公司。
        </p>
      )}
      <Button asChild variant="outline">
        <Link
          to={record ? `/recruitment/${record.id}` : "/recruitment/create"}
          state={record ? undefined : { record: { company_id: companyId } }}
        >
          {record ? "查看 / 编辑招聘信号" : "添加招聘信号"}
        </Link>
      </Button>
      {record && <RecruitmentFollowUp record={record} />}
    </div>
  );
};
