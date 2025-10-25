import React from 'react';
import { useAuthStore } from '@/stores/simpleAuthStore';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Building2, CreditCard, Users } from 'lucide-react';

export default function Dashboard() {
  const { user, company } = useAuthStore((state) => ({
    user: state.user,
    company: state.company
  }));

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Dashboard</h1>
          <p className="text-muted-foreground">
            Welcome back, {user?.name || user?.email}
          </p>
        </div>
        {company && (
          <Badge variant="outline" className="flex items-center gap-2">
            <Building2 className="h-4 w-4" />
            {company.name}
          </Badge>
        )}
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {/* Company Info Card */}
        {company && (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Company</CardTitle>
              <Building2 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{company.name}</div>
              <p className="text-xs text-muted-foreground">
                Plan: {company.tier.charAt(0).toUpperCase() + company.tier.slice(1)}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Slug: {company.slug}
              </p>
            </CardContent>
          </Card>
        )}

        {/* Credits Card */}
        {company && (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Credits Remaining</CardTitle>
              <CreditCard className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{company.creditsRemaining.toLocaleString()}</div>
              <p className="text-xs text-muted-foreground">
                Processing credits available
              </p>
            </CardContent>
          </Card>
        )}

        {/* User Info Card */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Account</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{user?.role || 'User'}</div>
            <p className="text-xs text-muted-foreground">
              {user?.email}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
          <CardDescription>
            Common tasks and features
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <button className="p-4 border rounded-lg hover:bg-muted text-left">
              <h3 className="font-medium">Upload Documents</h3>
              <p className="text-sm text-muted-foreground">Process new documents</p>
            </button>
            <button className="p-4 border rounded-lg hover:bg-muted text-left">
              <h3 className="font-medium">View History</h3>
              <p className="text-sm text-muted-foreground">Check processing history</p>
            </button>
            <button className="p-4 border rounded-lg hover:bg-muted text-left">
              <h3 className="font-medium">Templates</h3>
              <p className="text-sm text-muted-foreground">Manage form templates</p>
            </button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}