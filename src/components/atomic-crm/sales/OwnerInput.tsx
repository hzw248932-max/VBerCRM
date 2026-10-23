import { useCanAccess, useRecordContext, useTranslate } from "ra-core";
import { ReferenceInput } from "@/components/admin/reference-input";
import { SelectInput } from "@/components/admin/select-input";
import { ReferenceField } from "@/components/admin/reference-field";
import type { Sale } from "../types";

// Ownership can only be assigned or transferred by an administrator.
export const OwnerInput = () => {
  const { canAccess } = useCanAccess({ resource: "sales", action: "list" });
  const record = useRecordContext();
  const translate = useTranslate();
  if (!canAccess)
    return (
      <div className="text-sm text-muted-foreground">
        {translate("crm.common.account_manager")}:{" "}
        {record?.sales_id != null ? (
          <ReferenceField source="sales_id" reference="sales" link={false} />
        ) : (
          "当前用户"
        )}
        <p>负责人由管理员分配或转交。</p>
      </div>
    );
  return (
    <ReferenceInput
      source="sales_id"
      reference="sales"
      filter={{ "disabled@neq": true }}
      sort={{ field: "last_name", order: "ASC" }}
    >
      <SelectInput
        label="crm.common.account_manager"
        helperText={false}
        optionText={(sale: Sale) => `${sale.first_name} ${sale.last_name}`}
      />
    </ReferenceInput>
  );
};
