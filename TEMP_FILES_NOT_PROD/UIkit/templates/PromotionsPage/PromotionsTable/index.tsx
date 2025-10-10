import { useState } from "react";
import Table from "@/components/Table";
import TableRow from "@/components/TableRow";
import Actions from "@/components/Actions";
import { useSelection } from "@/hooks/useSelection";
import { PromotionsTableType } from "@/types/table";

import { tableContent } from "./content";

const PromotionsTable = ({}) => {
    const { selectedRows, selectAll, handleRowSelect, handleSelectAll } =
        useSelection<PromotionsTableType>(tableContent);
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
                "Code",
                "Discount",
                "Used",
                "Expiry Date",
                "Status",
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
                    <td>{item.code}</td>
                    <td>{item.discount}</td>
                    <td>{item.used}</td>
                    <td>{item.expiryDate}</td>
                    <td>
                        <div className="status status-green">{item.status}</div>
                    </td>
                    <td className="w-11">
                        <Actions />
                    </td>
                </TableRow>
            ))}
        </Table>
    );
};

export default PromotionsTable;
