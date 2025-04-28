"use client";

import { useState } from "react";
import { Button } from "@/features/ui/components/button";
import { Input } from "@/features/ui/components/input";
import { Label } from "@/features/ui/components/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/features/ui/components/select";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/features/ui/components/collapsible";
import {
  BadgeCheck,
  ChevronDown,
  Clock,
  Filter,
  RefreshCw,
  Search,
  X,
} from "lucide-react";
import { Badge } from "@/features/ui/components/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/features/ui/components/card";

export default function DashboardFilters() {
  const [searchQuery, setSearchQuery] = useState("");
  const [status, setStatus] = useState<string>("");
  const [timeframe, setTimeframe] = useState<string>("");
  const [filtersOpen, setFiltersOpen] = useState(true);
  const [appliedFilters, setAppliedFilters] = useState<string[]>([]);

  const handleApplyFilters = () => {
    const newFilters: string[] = [];
    if (searchQuery) newFilters.push(`Search: ${searchQuery}`);
    if (status) newFilters.push(`Status: ${status}`);
    if (timeframe) newFilters.push(`Time: ${timeframe}`);
    setAppliedFilters(newFilters);

    // Here you would normally update the URL or fetch filtered results
  };

  const handleClearFilters = () => {
    setSearchQuery("");
    setStatus("");
    setTimeframe("");
    setAppliedFilters([]);
  };

  const handleRemoveFilter = (filter: string) => {
    const filterType = filter.split(":")[0].trim();
    if (filterType === "Search") setSearchQuery("");
    if (filterType === "Status") setStatus("");
    if (filterType === "Time") setTimeframe("");

    setAppliedFilters(appliedFilters.filter((f) => f !== filter));
  };

  return (
    <Card className="h-full">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-medium">Filters</CardTitle>
          <CollapsibleTrigger
            asChild
            onClick={() => setFiltersOpen(!filtersOpen)}
            className="lg:hidden"
          >
            <Button variant="ghost" size="sm">
              <ChevronDown
                className={`h-4 w-4 ${filtersOpen ? "transform rotate-180" : ""}`}
              />
            </Button>
          </CollapsibleTrigger>
        </div>
        <CardDescription>Narrow down your proposals</CardDescription>
      </CardHeader>

      <Collapsible open={filtersOpen} className="lg:block">
        <CollapsibleContent className="pb-4 space-y-5">
          <CardContent className="pb-0 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="search">Search</Label>
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  id="search"
                  placeholder="Search proposals..."
                  className="pl-8"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="status">Status</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger id="status">
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="research">Research</SelectItem>
                  <SelectItem value="outlining">Outlining</SelectItem>
                  <SelectItem value="writing">Writing</SelectItem>
                  <SelectItem value="reviewing">Reviewing</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="timeframe">Timeframe</Label>
              <Select value={timeframe} onValueChange={setTimeframe}>
                <SelectTrigger id="timeframe">
                  <SelectValue placeholder="Select timeframe" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="today">Today</SelectItem>
                  <SelectItem value="this-week">This week</SelectItem>
                  <SelectItem value="this-month">This month</SelectItem>
                  <SelectItem value="this-year">This year</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center justify-between pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleClearFilters}
                className="h-8 text-xs"
              >
                <X className="mr-1 h-3.5 w-3.5" />
                Reset
              </Button>
              <Button
                size="sm"
                onClick={handleApplyFilters}
                className="h-8 text-xs"
              >
                <Filter className="mr-1 h-3.5 w-3.5" />
                Apply Filters
              </Button>
            </div>
          </CardContent>

          {appliedFilters.length > 0 && (
            <CardContent className="pt-0">
              <div className="pt-4 border-t">
                <h4 className="mb-2 text-sm font-medium">Applied Filters</h4>
                <div className="flex flex-wrap gap-2">
                  {appliedFilters.map((filter, index) => (
                    <Badge
                      key={index}
                      variant="secondary"
                      className="gap-1 px-1.5 py-0.5"
                    >
                      {filter.startsWith("Search:") && (
                        <Search className="w-3 h-3" />
                      )}
                      {filter.startsWith("Status:") && (
                        <BadgeCheck className="w-3 h-3" />
                      )}
                      {filter.startsWith("Time:") && (
                        <Clock className="w-3 h-3" />
                      )}
                      <span className="text-xs">{filter}</span>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-3.5 w-3.5 p-0 ml-1"
                        onClick={() => handleRemoveFilter(filter)}
                      >
                        <X className="h-2.5 w-2.5" />
                      </Button>
                    </Badge>
                  ))}
                </div>
              </div>
            </CardContent>
          )}
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}
