"use client";

import React from "react";
import { TrainingSessionPrintDocument } from "./print/TrainingSessionPrintDocument";

interface SessionPrintReportProps {
  session: any;
  organizationSettings?: any;
  teamName?: string;
  activeSquadPlayers?: any[];
}

export function SessionPrintReport({
  session,
  organizationSettings = {},
  teamName,
  activeSquadPlayers = [],
}: SessionPrintReportProps) {
  if (!session) return null;

  return (
    <div className="session-print-container w-full bg-white text-slate-900 font-sans print:m-0 print:p-0">
      <TrainingSessionPrintDocument
        session={session}
        organizationSettings={organizationSettings}
        teamName={teamName}
        activeSquadPlayers={activeSquadPlayers}
      />
    </div>
  );
}

export default SessionPrintReport;
