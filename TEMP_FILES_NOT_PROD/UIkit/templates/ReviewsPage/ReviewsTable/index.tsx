import { useState } from "react";
import Table from "@/components/Table";
import TableRow from "@/components/TableRow";
import Actions from "@/components/Actions";
import { useSelection } from "@/hooks/useSelection";
import { ReviewsTableType } from "@/types/table";
import Rating from "./Rating";

import { tableContent } from "./content";

const ReviewsTable = ({}) => {
    const { selectedRows, selectAll, handleRowSelect, handleSelectAll } =
        useSelection<ReviewsTableType>(tableContent);
    const [search, setSearch] = useState("");

    return (
        <Table
            className="mt-6"
            title="Reviews Table"
            search={search}
            setSearch={(e) => setSearch(e.target.value)}
            selectAll={selectAll}
            onSelectAll={handleSelectAll}
            cellsThead={[
                "Attendee Name",
                "Event Name",
                "Rating",
                "Date",
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
                    <td>{item.attendeeName}</td>
                    <td>{item.eventName}</td>
                    <td>
                        <Rating value={item.rating} />
                    </td>
                    <td>{item.reviewText}</td>
                    <td>{item.date}</td>
                    <td>
                        <div className="status status-green">
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

export default ReviewsTable;
