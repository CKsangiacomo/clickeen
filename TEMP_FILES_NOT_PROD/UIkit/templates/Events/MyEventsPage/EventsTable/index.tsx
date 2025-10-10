import { useState } from "react";
import Table from "@/components/Table";
import TableRow from "@/components/TableRow";
import Action from "@/components/Action";
import ModalDelete from "@/components/ModalDelete";
import { useSelection } from "@/hooks/useSelection";
import { EventsTableType } from "@/types/table";

import { tableContent } from "./content";

const EventsTable = ({}) => {
    const { selectedRows, selectAll, handleRowSelect, handleSelectAll } =
        useSelection<EventsTableType>(tableContent);
    const [search, setSearch] = useState("");
    const [isModalDeleteOpen, setIsModalDeleteOpen] = useState(false);

    return (
        <>
            <Table
                className="mt-6"
                title="Events Table"
                search={search}
                setSearch={(e) => setSearch(e.target.value)}
                selectAll={selectAll}
                onSelectAll={handleSelectAll}
                cellsThead={[
                    "Event Name",
                    "Date & Time",
                    "Status",
                    "Tickets Sold",
                    "Revenue",
                    "Actions",
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
                        <td>{item.dateAndTime}</td>
                        <td>
                            <div
                                className={`status ${
                                    item.status === "Draft"
                                        ? "status-sky"
                                        : item.status === "Cancelled"
                                        ? "status-red"
                                        : "status-green"
                                }`}
                            >
                                {item.status}
                            </div>
                        </td>
                        <td>{item.ticketsSold}</td>
                        <td>{item.revenue}</td>
                        <td className="w-33">
                            <div className="flex items-center gap-2">
                                <Action isView />
                                <Action />
                                <Action
                                    isRemove
                                    onClick={() => setIsModalDeleteOpen(true)}
                                />
                            </div>
                        </td>
                    </TableRow>
                ))}
            </Table>
            <ModalDelete
                content="Are you sure you want to delete this payout?"
                open={isModalDeleteOpen}
                onClose={() => setIsModalDeleteOpen(false)}
                onDelete={() => setIsModalDeleteOpen(false)}
            />
        </>
    );
};

export default EventsTable;
