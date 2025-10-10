import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    ResponsiveContainer,
} from "recharts";
import millify from "millify";
import Widget from "@/components/Widget";

import { data } from "./data";

const legend = [
    { label: "Revenue", color: "#E8F0FF" },
    { label: "Tickets Sold", color: "#1565FF" },
];

const SalesAnalytics = ({}) => {
    const formatterYAxis = (value: number) => {
        if (value === 0) {
            return "$0";
        }
        return `$${millify(value, {
            lowercase: false,
        })}`;
    };

    return (
        <Widget
            title="Sales Analytics"
            rightContent={
                <div className="flex gap-3 max-md:w-full">
                    {legend.map((item, index) => (
                        <div
                            className="flex items-center h-8 gap-1.5 text-gray-500 max-md:h-auto"
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
            }
        >
            <div className="h-85 pt-2.5 pr-5 pb-5">
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
                        barSize={24}
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
                        <Bar
                            dataKey="tickets"
                            fill="#1565FF"
                            stackId="a"
                            radius={[0, 0, 5, 5]}
                        />
                        <Bar
                            dataKey="revenue"
                            fill="#E8F0FF"
                            stackId="a"
                            radius={[5, 5, 0, 0]}
                        />
                    </BarChart>
                </ResponsiveContainer>
            </div>
        </Widget>
    );
};

export default SalesAnalytics;
