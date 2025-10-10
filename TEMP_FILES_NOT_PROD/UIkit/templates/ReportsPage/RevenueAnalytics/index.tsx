import { useState } from "react";
import {
    ResponsiveContainer,
    AreaChart,
    Area,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
} from "recharts";
import millify from "millify";
import Widget from "@/components/Widget";
import Percentage from "@/components/Percentage";

import { data } from "./data";

const durationOptions = [
    { id: 1, name: "Month" },
    { id: 2, name: "Week" },
    { id: 3, name: "Day" },
];

const legend = [
    { label: "This period", color: "#1565FF" },
    { label: "Last period", color: "#B6CFFF" },
];

const RevenueAnalytics = ({}) => {
    const [duration, setDuration] = useState(durationOptions[0]);

    const formatterYAxis = (value: number) => {
        if (value === 0) {
            return "$0";
        }
        return `$${millify(value, {
            lowercase: false,
        })}`;
    };

    const CustomTooltip = ({ payload }: { payload: { value: number }[] }) => {
        if (payload && payload.length) {
            return (
                <div className="chart-tooltip min-w-40 !p-3 !border-0 text-body-sm">
                    <div className="mb-2 pb-2 border-b border-gray-100 font-medium">
                        Total Revenue
                    </div>
                    <div className="flex flex-col gap-1">
                        <div className="flex justify-between items-center gap-2">
                            <div className="text-gray-500">May 13, 2025</div>
                            <div className="font-semibold text-primary-500">
                                {formatterYAxis(payload[0].value)}
                            </div>
                        </div>
                        <div className="flex justify-between items-center gap-2">
                            <div className="text-gray-500">Apr 13, 2025</div>
                            <div className="font-semibold text-gray-400">
                                {formatterYAxis(payload[1].value)}
                            </div>
                        </div>
                    </div>
                </div>
            );
        }
        return null;
    };

    return (
        <Widget
            className="mt-6"
            title="Revenue Analytics"
            selectOptions={durationOptions}
            selectValue={duration}
            selectOnChange={setDuration}
        >
            <div className="flex items-end p-5 max-md:block">
                <div className="flex items-center max-md:mb-2">
                    <div className="text-h4">$1,302.00</div>
                    <Percentage className="ml-2" value={-8.5} isSimple />
                    <div className="ml-1.5 text-gray-500">from last period</div>
                </div>
                <div className="flex gap-3 ml-auto">
                    {legend.map((item, index) => (
                        <div
                            className="flex items-center gap-1.5 text-gray-500"
                            key={index}
                        >
                            <div
                                className="size-2 rounded-xs"
                                style={{ backgroundColor: item.color }}
                            />
                            <div className="">{item.label}</div>
                        </div>
                    ))}
                </div>
            </div>
            <div className="h-50 -ml-1 pt-2 pr-5 pb-4">
                <ResponsiveContainer width="100%" height="100%">
                    <AreaChart
                        width={730}
                        height={250}
                        data={data}
                        margin={{ top: 10, right: 5, left: 0, bottom: 0 }}
                    >
                        <defs>
                            <linearGradient
                                id="color"
                                x1="0"
                                y1="0"
                                x2="0"
                                y2="1"
                            >
                                <stop
                                    offset="0%"
                                    stopColor="#1565FF"
                                    stopOpacity={0.12}
                                />
                                <stop
                                    offset="95%"
                                    stopColor="#1565FF"
                                    stopOpacity={0}
                                />
                            </linearGradient>
                        </defs>
                        <CartesianGrid
                            horizontal={false}
                            strokeDasharray="5 5"
                            stroke="#DFE1E7"
                        />
                        <XAxis
                            hide={true}
                            dataKey="name"
                            axisLine={false}
                            tickLine={false}
                            tick={{
                                fontSize: "0.875rem",
                                fill: "#666D80",
                            }}
                            tickFormatter={(value) => value.slice(0, 3)}
                            height={32}
                            dy={8}
                        />
                        <YAxis
                            tickFormatter={formatterYAxis}
                            axisLine={false}
                            tickLine={false}
                            tick={{
                                fontSize: "0.875rem",
                                fill: "#666D80",
                            }}
                        />
                        <Tooltip
                            content={<CustomTooltip payload={[]} />}
                            cursor={{
                                stroke: "#0D0D12",
                                strokeDasharray: "5 5",
                            }}
                        />
                        <Area
                            type="linear"
                            dataKey="tp"
                            stroke="#1565FF"
                            strokeWidth={2}
                            fillOpacity={1}
                            fill="url(#color)"
                            dot={false}
                            activeDot={{
                                r: 5,
                                fill: "#1565FF",
                                stroke: "#ffffff",
                                strokeWidth: 2,
                            }}
                        />
                        <Line
                            type="linear"
                            dataKey="lp"
                            stroke="#B6CFFF"
                            strokeWidth={2}
                            dot={false}
                            activeDot={{
                                r: 5,
                                fill: "#B6CFFF",
                                stroke: "#ffffff",
                                strokeWidth: 2,
                            }}
                        />
                    </AreaChart>
                </ResponsiveContainer>
            </div>
            <div className="flex justify-between pb-5 pl-11.5 pr-5 text-gray-500">
                <div>May 01, 2025</div>
                <div>May 15, 2025</div>
            </div>
        </Widget>
    );
};

export default RevenueAnalytics;
