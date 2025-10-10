import { useState } from "react";
import Table from "@/components/Table";
import TableRow from "@/components/TableRow";
import Actions from "@/components/Actions";
import { useSelection } from "@/hooks/useSelection";
import { UpcomingEventsType } from "@/types/table";

import { tableContent } from "./content";

const UpcomingEvents = ({}) => {
    const { selectedRows, selectAll, handleRowSelect, handleSelectAll } =
        useSelection<UpcomingEventsType>(tableContent);
    const [search, setSearch] = useState("");

    return (
        <Table
            className="mt-6"
            title="Upcoming Events"
            search={search}
            setSearch={(e) => setSearch(e.target.value)}
            selectAll={selectAll}
            onSelectAll={handleSelectAll}
            cellsThead={[
                "Event Name",
                "Date & Time",
                "Status",
                "Tickets Sold",
                "",
            ]}
            isShortHead
        >
            {tableContent.map((item) => (
                <TableRow
                    key={item.id}
                    selectedRows={selectedRows.includes(item.id)}
                    onRowSelect={() => handleRowSelect(item.id)}
                >
                    <td>{item.eventName}</td>
                    <td>{item.dateAndTime}</td>
                    <td>
                        <div className="status status-green">{item.status}</div>
                    </td>
                    <td>{item.ticketsSold}</td>
                    <td className="w-11">
                        <Actions />
                    </td>
                </TableRow>
            ))}
        </Table>
    );
};

export default UpcomingEvents;
