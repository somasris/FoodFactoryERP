import React from 'react';
import { Link } from 'react-router-dom';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from '../components/common/Card';
import { Button } from '../components/common/Button';
import { HelpCircle } from 'lucide-react';

export const NotFoundPage: React.FC = () => {
  return (
    <div className="flex justify-center items-center py-16">
      <Card className="max-w-md w-full text-center border-slate-200 shadow-sm">
        <CardHeader>
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-500 mb-2">
            <HelpCircle className="h-6 w-6" />
          </div>
          <CardTitle>404 - Page Not Found</CardTitle>
          <CardDescription>The requested page does not exist in FoodFactory ERP.</CardDescription>
        </CardHeader>
        <CardContent className="pt-2">
          <Link to="/">
            <Button variant="default">Return to Dashboard</Button>
          </Link>
        </CardContent>
      </Card>
    </div>
  );
};
