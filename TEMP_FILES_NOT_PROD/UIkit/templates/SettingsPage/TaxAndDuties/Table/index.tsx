import Image from "@/components/Image";

import { taxes } from "./taxes";

const Table = ({}) => (
    <div className="border border-gray-100 rounded-2xl overflow-hidden">
        <table className="w-full [&_th,&_td]:pl-3 [&_th,&_td]:last:pr-3">
            <thead>
                <tr className="[&_th]:py-2.5 [&_th]:bg-gray-25 [&_th]:text-left [&_th]:text-body-sm [&_th]:font-medium [&_th]:text-gray-500">
                    <th>Country or Region</th>
                    <th>Collecting</th>
                    <th>Percentage</th>
                </tr>
            </thead>
            <tbody>
                {taxes.map((tax) => (
                    <tr
                        className="[&_td]:py-3 [&_td]:border-t [&_td]:border-gray-100 [&_td]:font-medium [&_td]:text-gray-900"
                        key={tax.id}
                    >
                        <td>
                            <div className="flex items-center gap-3">
                                <Image
                                    className="size-6 opacity-100"
                                    src={tax.flag}
                                    width={24}
                                    height={24}
                                    alt={tax.country}
                                />
                                {tax.country}
                            </div>
                        </td>
                        <td>{tax.collecting}</td>
                        <td>{tax.percentage}</td>
                    </tr>
                ))}
            </tbody>
        </table>
    </div>
);

export default Table;
