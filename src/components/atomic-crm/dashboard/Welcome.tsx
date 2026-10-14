import { useTranslate } from "ra-core";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
export const Welcome = () => {
  const translate = useTranslate();
  return (
    <Card>
      <CardHeader className="px-4">
        <CardTitle>{translate("vber.welcome")}</CardTitle>
      </CardHeader>
      <CardContent className="px-4 space-y-4 text-sm">
        <p>{translate("vber.description")}</p>
        <p>{translate("vber.demo")}</p>
        <a
          href="https://github.com/marmelab/atomic-crm"
          className="block text-muted-foreground underline hover:no-underline"
        >
          {translate("vber.attribution")}
        </a>
      </CardContent>
    </Card>
  );
};
