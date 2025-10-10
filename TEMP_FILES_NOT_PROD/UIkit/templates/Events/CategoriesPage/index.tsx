"use client";

import { useState } from "react";
import Layout from "@/components/Layout";
import Breadcrumbs from "@/components/Breadcrumbs";
import Button from "@/components/Button";
import Table from "@/components/Table";
import TableRow from "@/components/TableRow";
import Action from "@/components/Action";
import ModalDelete from "@/components/ModalDelete";
import Modal from "@/components/Modal";
import { useSelection } from "@/hooks/useSelection";
import { CategoriesType } from "@/types/table";
import AddNewCategory from "./AddNewCategory";

import { tableContent } from "./content";

const CategoriesPage = () => {
    const { selectedRows, selectAll, handleRowSelect, handleSelectAll } =
        useSelection<CategoriesType>(tableContent);
    const [search, setSearch] = useState("");
    const [isModalDeleteOpen, setIsModalDeleteOpen] = useState(false);
    const [isModalNewCategory, setIsModalNewCategory] = useState(false);

    return (
        <>
            <Layout title="Categories">
                <Breadcrumbs items={["Management", "Events", "Categories"]}>
                    <Button
                        className="max-md:w-full"
                        isPrimary
                        isMedium
                        onClick={() => setIsModalNewCategory(true)}
                    >
                        Add New Category
                    </Button>
                </Breadcrumbs>
                <Table
                    className="mt-6"
                    title="Categories Table"
                    search={search}
                    setSearch={(e) => setSearch(e.target.value)}
                    selectAll={selectAll}
                    onSelectAll={handleSelectAll}
                    cellsThead={[
                        "Category Name",
                        "Slug",
                        "Events Count",
                        "Status",
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
                            <td>{item.categoryName}</td>
                            <td>{item.slug}</td>
                            <td>{item.eventsCount}</td>
                            <td>
                                <div className="status status-green">
                                    {item.status}
                                </div>
                            </td>
                            <td className="w-33">
                                <div className="flex items-center gap-2">
                                    <Action isView />
                                    <Action />
                                    <Action
                                        isRemove
                                        onClick={() =>
                                            setIsModalDeleteOpen(true)
                                        }
                                    />
                                </div>
                            </td>
                        </TableRow>
                    ))}
                </Table>
            </Layout>
            <ModalDelete
                content="Are you sure you want to delete this category?"
                open={isModalDeleteOpen}
                onClose={() => setIsModalDeleteOpen(false)}
                onDelete={() => setIsModalDeleteOpen(false)}
            />
            <Modal
                title="New Category"
                open={isModalNewCategory}
                onClose={() => setIsModalNewCategory(false)}
                isSlidePanel
                contentFooter={
                    <Button className="min-w-30" isPrimary isMedium>
                        Submit
                    </Button>
                }
            >
                <AddNewCategory />
            </Modal>
        </>
    );
};

export default CategoriesPage;
