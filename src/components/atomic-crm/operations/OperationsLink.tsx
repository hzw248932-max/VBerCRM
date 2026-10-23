import { Link } from "react-router";
import { Button } from "@/components/ui/button";

export const OperationsLink = () => (
  <div className="flex justify-end mb-4">
    <Button asChild variant="outline">
      <Link to="/operations">数据质量、备份与报表</Link>
    </Button>
  </div>
);
