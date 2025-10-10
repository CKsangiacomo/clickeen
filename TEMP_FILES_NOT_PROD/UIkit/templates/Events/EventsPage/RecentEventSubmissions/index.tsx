import { useState } from "react";
import Link from "next/link";
import Table from "@/components/Table";
import TableRow from "@/components/TableRow";
import Actions from "@/components/Actions";
import { useSelection } from "@/hooks/useSelection";
import { RecentEventSubmissionsType } from "@/types/table";

import { tableContent } from "./content";

const RecentEventSubmissions = ({}) => {
    const { selectedRows, selectAll, handleRowSelect, handleSelectAll } =
        useSelection<RecentEventSubmissionsType>(tableContent);
    const [search, setSearch] = useState("");

    return (
        <Table
            title="Recent Event Submissions"
            search={search}
            setSearch={(e) => setSearch(e.target.value)}
            selectAll={selectAll}
            onSelectAll={handleSelectAll}
            cellsThead={[
                "Event Title",
                "Organizer",
                "Category",
                "Status",
                "Tickets Sold",
                "Start Date",
                "",
            ]}
            isNumber
        >
            {tableContent.map((item, index) => (
                <TableRow
                    key={item.id}
                    index={index}
                    selectedRows={selectedRows.includes(item.id)}
                    onRowSelect={() => handleRowSelect(item.id)}
                >
                    <td>{item.title}</td>
                    <td>{item.organizer}</td>
                    <td>
                        <Link href="/events/categories">{item.category}</Link>
                    </td>
                    <td>
                        <div className="status status-green">{item.status}</div>
                    </td>
                    <td>{item.ticketsSold}</td>
                    <td>{item.startDate}</td>
                    <td className="w-11">
                        <Actions />
                    </td>
                </TableRow>
            ))}
        </Table>
    );
};

export default RecentEventSubmissions;
