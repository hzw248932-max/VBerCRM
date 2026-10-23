// FIXME: This should be exported from the ra-core package
type CanAccessParams<
  RecordType extends Record<string, any> = Record<string, any>,
> = {
  action: string;
  resource: string;
  record?: RecordType;
};

export const canAccess = <
  RecordType extends Record<string, any> = Record<string, any>,
>(
  role: string,
  params: CanAccessParams<RecordType>,
  userId?: string | number,
) => {
  if (role === "admin") {
    return true;
  }
  if (role !== "user") return false;
  if (params.action === "assign") return false;

  // Non admins can't access the sales resource
  if (params.resource === "sales") {
    return false;
  }

  // Non admins can't access the configuration resource
  if (params.resource === "configuration") {
    return false;
  }

  const ownedResources = [
    "companies",
    "companies_summary",
    "contacts",
    "contacts_summary",
    "deals",
    "tasks",
    "recruitment",
    "contact_notes",
    "deal_notes",
  ];
  if (
    ownedResources.includes(params.resource) &&
    ["edit", "delete", "update"].includes(params.action) &&
    params.record
  ) {
    return (
      userId != null &&
      params.record.sales_id != null &&
      String(params.record.sales_id) === String(userId)
    );
  }

  return true;
};
