import { Card, CardContent } from "@/components/ui/card";
import { ArrowUpIcon } from "lucide-react";

interface StatsCardProps {
  title: string;
  growthPercent: number;
  stats: {
    label: string;
    value: string;
    change: {
      value: number;
      period: string;
    };
  }[];
}

export function StatsCard({ title, growthPercent, stats }: StatsCardProps) {
  return (
    <Card className="border border-gray-200">
      <CardContent className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-lg">{title}</h2>
          <div className="bg-green-100 text-green-800 px-3 py-1 rounded-full text-xs font-medium">
            +{growthPercent}%
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          {stats.map((stat, index) => (
            <div key={index} className={index < stats.length - 1 ? "border-r border-gray-200 pr-4" : ""}>
              <p className="text-gray-500 text-sm mb-1">{stat.label}</p>
              <p className="text-2xl font-bold">{stat.value}</p>
              <p className="text-green-500 text-xs mt-1 flex items-center">
                <ArrowUpIcon className="mr-1 h-3 w-3" /> 
                {stat.change.value}% from {stat.change.period}
              </p>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
