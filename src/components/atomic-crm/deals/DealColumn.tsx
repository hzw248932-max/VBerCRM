import { Droppable } from "@hello-pangea/dnd";
import { useTranslate } from "ra-core";

import { useConfigurationContext } from "../root/ConfigurationContext";
import type { Deal } from "../types";
import { findDealLabel } from "./dealUtils";
import { DealCard } from "./DealCard";

export const DealColumn = ({
  stage,
  deals,
  companyCount,
}: {
  stage: string;
  deals: Deal[];
  companyCount?: number;
}) => {
  const { dealStages } = useConfigurationContext();
  const translate = useTranslate();
  const stageLabel = findDealLabel(dealStages, stage) ?? stage;
  return (
    <div className="flex-1 pb-8">
      <div className="flex flex-col items-center">
        <h3 className="text-base font-medium">
          {translate(stageLabel, { _: stageLabel })}
        </h3>
        <p className="text-sm text-muted-foreground">
          {companyCount == null
            ? "—"
            : translate("resources.deals.company_count", {
                count: companyCount,
              })}
        </p>
      </div>
      <Droppable droppableId={stage}>
        {(droppableProvided, snapshot) => (
          <div
            ref={droppableProvided.innerRef}
            {...droppableProvided.droppableProps}
            className={`flex flex-col rounded-2xl mt-2 gap-2 ${
              snapshot.isDraggingOver ? "bg-muted" : ""
            }`}
          >
            {deals.map((deal, index) => (
              <DealCard key={deal.id} deal={deal} index={index} />
            ))}
            {droppableProvided.placeholder}
          </div>
        )}
      </Droppable>
    </div>
  );
};
