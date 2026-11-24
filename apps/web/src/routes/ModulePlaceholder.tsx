import React from 'react';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from '../components/common/Card';
import { Badge } from '../components/common/Badge';
import { Info, ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';

interface ModulePlaceholderProps {
  moduleName: string;
  phase: string;
  summary: string;
  scopePoints: string[];
}

export const ModulePlaceholder: React.FC<ModulePlaceholderProps> = ({
  moduleName,
  phase,
  summary,
  scopePoints,
}) => {
  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <Link
        to="/"
        className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600 hover:text-brand-navy"
      >
        <ArrowLeft className="h-4 w-4" />
        <span>Back to Foundation Dashboard</span>
      </Link>

      <Card className="border-slate-200 shadow-sm">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-xl">{moduleName}</CardTitle>
            <Badge variant="teal">{phase}</Badge>
          </div>
          <CardDescription className="text-sm pt-2">{summary}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-md bg-slate-50 border border-slate-200 p-4">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-600 mb-2">
              <Info className="h-4 w-4 text-brand-blue" />
              <span>Architectural Specifications for this Module</span>
            </div>
            <ul className="list-disc list-inside space-y-1.5 text-xs text-slate-600">
              {scopePoints.map((pt, idx) => (
                <li key={idx}>{pt}</li>
              ))}
            </ul>
          </div>

          <p className="text-xs text-slate-500 italic">
            This module directory exists as an architectural placeholder in{' '}
            <code className="text-brand-navy font-semibold">apps/api/src/modules/</code> and will be
            fully implemented during its designated phase.
          </p>
        </CardContent>
      </Card>
    </div>
  );
};
