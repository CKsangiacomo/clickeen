import { useState } from "react";
import Table from "@/components/Table";
import TableRow from "@/components/TableRow";
import Action from "@/components/Action";
import ModalDelete from "@/components/ModalDelete";
import { useSelection } from "@/hooks/useSelection";
import { RecentPayoutRequestType } from "@/types/table";

import { tableContent } from "./content";

const PayoutsTable = ({}) => {
    const { selectedRows, selectAll, handleRowSelect, handleSelectAll } =
        useSelection<RecentPayoutRequestType>(tableContent);
    const [search, setSearch] = useState("");
    const [isModalDeleteOpen, setIsModalDeleteOpen] = useState(false);

    return (
        <>
            <Table
                className="mt-6"
                title="Payouts Table"
                search={search}
                setSearch={(e) => setSearch(e.target.value)}
                selectAll={selectAll}
                onSelectAll={handleSelectAll}
                cellsThead={[
                    "Organizer",
                    "Amount",
                    "Requested On",
                    "Status",
                    "Processed On",
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
                        <td>{item.organizer}</td>
                        <td>{item.amount}</td>
                        <td>{item.requestedOn}</td>
                        <td>
                            <div
                                className={`status ${
                                    item.status === "Pending"
                                        ? "status-yellow"
                                        : item.status === "Rejected"
                                        ? "status-red"
                                        : "status-green"
                                }`}
                            >
                                {item.status}
                            </div>
                        </td>
                        <td>{item.processedOn}</td>
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

export default PayoutsTable;
