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

import { data } from "./data";

const TopSellingEvents = ({}) => {
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
                    <div className="mb-2 font-semibold">{label}</div>
                    <div className="flex flex-col gap-2">
                        <div className="flex justify-between items-center gap-2">
                            <div className="font-medium text-gray-400">
                                Ticket Sold
                            </div>
                            <div className="font-semibold text-primary-500">
                                {payload[0].value}
                            </div>
                        </div>
                        <div className="flex justify-between items-center gap-2">
                            <div className="font-medium text-gray-400">
                                Ticket Available
                            </div>
                            <div className="font-semibold">117</div>
                        </div>
                    </div>
                </div>
            );
        }
        return null;
    };

    return (
        <Widget className="grow" title="Top Selling Events">
            <div className="h-103 pt-5 pr-5 pb-4 max-md:h-98">
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
                            tickFormatter={(value) =>
                                value.slice(0, 6) +
                                (value.length > 6 ? "..." : "")
                            }
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
                            cursor={{ fill: "transparent" }}
                        />
                        <Bar
                            dataKey="ts"
                            fill="#ECEFF3"
                            activeBar={{ fill: "#1565FF" }}
                            barSize={54}
                            radius={8}
                        />
                    </BarChart>
                </ResponsiveContainer>
            </div>
        </Widget>
    );
};

export default TopSellingEvents;
