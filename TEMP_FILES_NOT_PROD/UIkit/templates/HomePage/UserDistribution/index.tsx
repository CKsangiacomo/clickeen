import { Cell, Pie, PieChart } from "recharts";
import Widget from "@/components/Widget";

import { data, COLORS } from "./data";

const UserDistribution = ({}) => {
    const total = data.reduce((sum, item) => sum + item.value, 0);

    const getPercentage = (value: number) => {
        return ((value / total) * 100).toFixed(0);
    };

    return (
        <Widget
            className="shrink-0 w-108 max-4xl:w-88 max-2xl:w-70 max-lg:w-full"
            title="User Distribution"
        >
            <div className="p-5">
                <div className="relative">
                    <PieChart
                        className="!size-46 mx-auto"
                        width={184}
                        height={184}
                    >
                        <Pie
                            data={data}
                            cx={86}
                            cy={86}
                            innerRadius={62}
                            outerRadius={91}
                            fill="#8884d8"
                            paddingAngle={1}
                            dataKey="value"
                        >
                            {data.map((entry, index) => (
                                <Cell
                                    key={`cell-${entry.name}`}
                                    fill={COLORS[index % COLORS.length]}
                                />
                            ))}
                        </Pie>
                    </PieChart>
                    <div className="absolute top-1/2 left-1/2 -translate-1/2 text-h5">
                        8,734
                    </div>
                </div>
                <div className="flex flex-col gap-1 mt-1.5">
                    {data.map((item, index) => (
                        <div
                            className="flex items-center gap-3 py-3 not-last:border-b border-gray-100 font-medium"
                            key={index}
                        >
                            <div
                                className="shrink-0 size-2.5 rounded-full"
                                style={{ backgroundColor: COLORS[index] }}
                            />
                            <div className="">{item.name}</div>
                            <div className="ml-auto">
                                {getPercentage(item.value)}%
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </Widget>
    );
};

export default UserDistribution;
