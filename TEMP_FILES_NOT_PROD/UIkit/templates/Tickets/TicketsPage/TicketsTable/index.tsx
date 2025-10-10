import { useState } from "react";
import Table from "@/components/Table";
import TableRow from "@/components/TableRow";
import Actions from "@/components/Actions";
import { useSelection } from "@/hooks/useSelection";
import { TicketsTableType } from "@/types/table";

import { tableContent } from "./content";

const TicketsTable = ({}) => {
    const { selectedRows, selectAll, handleRowSelect, handleSelectAll } =
        useSelection<TicketsTableType>(tableContent);
    const [search, setSearch] = useState("");

    return (
        <Table
            className="mt-6"
            title="Tickets Table"
            search={search}
            setSearch={(e) => setSearch(e.target.value)}
            selectAll={selectAll}
            onSelectAll={handleSelectAll}
            cellsThead={[
                "Ticket Name",
                "Price",
                "Quantity",
                "Sold",
                "Sales Status",
                "Visibility",
                "",
            ]}
            isNumber
            isPagination
        >
            {tableContent.map((item, index) => (
                <TableRow
                    key={item.id}
                    index={index}
                    selectedRows={selectedRows.includes(item.id)}
                    onRowSelect={() => handleRowSelect(item.id)}
                >
                    <td>{item.ticketName}</td>
                    <td>${item.price}</td>
                    <td>{item.quantity}</td>
                    <td>{item.sold}</td>
                    <td>
                        <div
                            className={`status ${
                                item.salesStatus === "Sold Out"
                                    ? "status-red"
                                    : "status-green"
                            }`}
                        >
                            {item.salesStatus}
                        </div>
                    </td>
                    <td>
                        <div
                            className={`status ${
                                item.visibility === "Hidden"
                                    ? "status-red"
                                    : "status-green"
                            }`}
                        >
                            {item.visibility}
                        </div>
                    </td>
                    <td className="w-11">
                        <Actions />
                    </td>
                </TableRow>
            ))}
        </Table>
    );
};

export default TicketsTable;
