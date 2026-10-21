import { CreateBase, Form, useGetIdentity, type MutationMode } from "ra-core";
import { Card, CardContent } from "@/components/ui/card";
import { useLocation } from "react-router";

import { ContactInputs } from "./ContactInputs";
import { FormToolbar } from "../layout/FormToolbar";
import {
  cleanupContactForCreate,
  defaultEmailJsonb,
  defaultPhoneJsonb,
} from "./contactModel";

export const ContactCreate = ({
  mutationMode,
}: {
  mutationMode?: MutationMode;
}) => {
  const { identity } = useGetIdentity();
  const { state } = useLocation();
  const recruitmentReturnId = state?.recruitmentReturnId;

  return (
    <CreateBase
      redirect={
        recruitmentReturnId != null
          ? `/recruitment/${encodeURIComponent(String(recruitmentReturnId))}`
          : "show"
      }
      transform={cleanupContactForCreate}
      mutationMode={mutationMode}
    >
      <div className="mt-2 flex lg:mr-72">
        <div className="flex-1">
          <Form
            defaultValues={{
              sales_id: identity?.id,
              email_jsonb: defaultEmailJsonb,
              phone_jsonb: defaultPhoneJsonb,
            }}
          >
            <Card>
              <CardContent>
                <ContactInputs />
                <FormToolbar />
              </CardContent>
            </Card>
          </Form>
        </div>
      </div>
    </CreateBase>
  );
};
