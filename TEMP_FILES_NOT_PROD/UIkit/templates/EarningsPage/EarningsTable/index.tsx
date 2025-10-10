import { useState } from "react";
import Table from "@/components/Table";
import TableRow from "@/components/TableRow";
import { useSelection } from "@/hooks/useSelection";
import { EarningsTableType } from "@/types/table";

import { tableContent } from "./content";

const EarningsTable = ({}) => {
    const { selectedRows, selectAll, handleRowSelect, handleSelectAll } =
        useSelection<EarningsTableType>(tableContent);
    const [search, setSearch] = useState("");

    return (
        <Table
            className="mt-6"
            title="Earnings Table"
            search={search}
            setSearch={(e) => setSearch(e.target.value)}
            selectAll={selectAll}
            onSelectAll={handleSelectAll}
            cellsThead={[
                "Event Name",
                "Tickets Sold",
                "Revenue",
                "Platform Fee",
                "Net Earnings",
                "Status",
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
                    <td>{item.eventName}</td>
                    <td>${item.ticketsSold}</td>
                    <td>${item.revenue}</td>
                    <td>${item.platformFee}</td>
                    <td>{item.netEarnings}</td>
                    <td>
                        <div
                            className={`status ${
                                item.status === "Available"
                                    ? "status-purple"
                                    : item.status === "Pending"
                                    ? "status-yellow"
                                    : "status-green"
                            }`}
                        >
                            {item.status}
                        </div>
                    </td>
                </TableRow>
            ))}
        </Table>
    );
};

export default EarningsTable;
