import { useState } from "react";
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
} from "recharts";
import Widget from "@/components/Widget";
import Percentage from "@/components/Percentage";

import { data } from "./data";

const durationOptions = [
    { id: 1, name: "Month" },
    { id: 2, name: "Week" },
    { id: 3, name: "Day" },
];

const legend = [
    { label: "Total Event", color: "#1565FF" },
    { label: "Ticket Sold", color: "#DFE1E7" },
];

const TicketSalesAnalytics = ({}) => {
    const [duration, setDuration] = useState(durationOptions[0]);

    const CustomTooltip = ({
        payload,
        label,
    }: {
        payload: { value: number }[];
        label: string;
    }) => {
        if (payload && payload.length) {
            return (
                <div className="chart-tooltip min-w-44">
                    <div className="mb-2 font-semibold">{label} 2025</div>
                    <div className="flex flex-col gap-2">
                        <div className="flex justify-between items-center gap-2">
                            <div className="font-medium text-gray-400">
                                Total Event
                            </div>
                            <div className="font-semibold text-primary-500">
                                {payload[0].value}
                            </div>
                        </div>
                        <div className="flex justify-between items-center gap-2">
                            <div className="font-medium text-gray-400">
                                Ticket Sold
                            </div>
                            <div className="font-semibold">
                                {payload[1].value}
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
            className="grow"
            title="Ticket Sales Analytics"
            selectOptions={durationOptions}
            selectValue={duration}
            selectOnChange={setDuration}
        >
            <div className="flex items-end px-5 py-3 max-md:block">
                <div className="flex items-center">
                    <div className="text-h4">324</div>
                    <Percentage className="ml-2" value={-4.5} isSimple />
                    <div className="ml-1.5 text-gray-500">
                        Last updated: Jun 16, 2025
                    </div>
                </div>
                <div className="flex gap-3 ml-auto max-md:mt-2">
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
            <div className="h-79.5 pr-5 pb-4 max-md:-ml-1.5">
                <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                        width={500}
                        height={300}
                        data={data}
                        margin={{
                            top: 10,
                            right: 0,
                            left: 0,
                            bottom: 0,
                        }}
                        barGap={5}
                    >
                        <CartesianGrid
                            vertical={false}
                            strokeDasharray="5 5"
                            stroke="#DFE1E7"
                        />
                        <XAxis
                            dataKey="name"
                            axisLine={false}
                            tickLine={false}
                            tick={{
                                fontSize: "0.875rem",
                                fill: "#818898",
                            }}
                            tickFormatter={(value) => value.slice(0, 3)}
                            height={32}
                            dy={8}
                        />
                        <YAxis
                            axisLine={false}
                            tickLine={false}
                            tick={{
                                fontSize: "0.875rem",
                                fill: "#818898",
                            }}
                        />
                        <Tooltip
                            content={<CustomTooltip payload={[]} label="" />}
                            cursor={{ fill: "#f6f8fa" }}
                        />
                        <Bar
                            dataKey="te"
                            fill="#1565FF"
                            barSize={10}
                            radius={5}
                        />
                        <Bar
                            dataKey="ts"
                            fill="#DFE1E7"
                            barSize={10}
                            radius={5}
                        />
                    </BarChart>
                </ResponsiveContainer>
            </div>
        </Widget>
    );
};

export default TicketSalesAnalytics;
