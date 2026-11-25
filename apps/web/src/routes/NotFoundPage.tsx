import React from 'react';
import { Link } from 'react-router-dom';
import { HelpCircle } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../components/common/Card';
import { Button } from '../components/common/Button';
import { useAuth } from '../hooks/useAuth';
import { getDefaultDashboardPath } from '../config/navigation';

export const NotFoundPage: React.FC = () => {
  const { user } = useAuth();
  const homePath = getDefaultDashboardPath(user);

  return (
    <div className="flex justify-center items-center py-16">
      <Card className="max-w-md w-full text-center">
        <CardHeader>
          <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-lg bg-slate-100 text-slate-500 mb-2 border border-slate-200">
            <HelpCircle className="h-5 w-5" />
          </div>
          <CardTitle className="text-base">404 — Page Not Found</CardTitle>
          <CardDescription>The requested page does not exist in FoodFactory ERP.</CardDescription>
        </CardHeader>
        <CardContent className="pt-1">
          <Link to={homePath}>
            <Button variant="default" size="sm">
              Return to My Dashboard
            </Button>
          </Link>
        </CardContent>
      </Card>
    </div>
  );
};
