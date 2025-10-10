"use client";

import { useState } from "react";
import Layout from "@/components/Layout";
import Breadcrumbs from "@/components/Breadcrumbs";
import Button from "@/components/Button";
import Table from "@/components/Table";
import TableRow from "@/components/TableRow";
import Action from "@/components/Action";
import Modal from "@/components/Modal";
import ModalDelete from "@/components/ModalDelete";
import { useSelection } from "@/hooks/useSelection";
import { UsersType } from "@/types/table";
import Details from "./Details";

import { tableContent } from "./content";

const UsersPage = () => {
    const { selectedRows, selectAll, handleRowSelect, handleSelectAll } =
        useSelection<UsersType>(tableContent);
    const [search, setSearch] = useState("");
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isModalDeleteOpen, setIsModalDeleteOpen] = useState(false);
    const [newUser, setNewUser] = useState(true);

    return (
        <>
            <Layout title="Users">
                <Breadcrumbs items={["Management", "Users"]}>
                    <div className="flex items-center gap-3">
                        <Button className="max-md:flex-1" isSecondary isMedium>
                            Export CSV
                        </Button>
                        <Button
                            className="max-md:flex-1"
                            isPrimary
                            isMedium
                            onClick={() => {
                                setIsModalOpen(true);
                                setNewUser(true);
                            }}
                        >
                            Add New User
                        </Button>
                    </div>
                </Breadcrumbs>
                <Table
                    className="mt-6"
                    title="User Table"
                    search={search}
                    setSearch={(e) => setSearch(e.target.value)}
                    selectAll={selectAll}
                    onSelectAll={handleSelectAll}
                    cellsThead={[
                        "Name",
                        "Email",
                        "Phone Number",
                        "Role",
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
                            <td>{item.name}</td>
                            <td>{item.email}</td>
                            <td>{item.phoneNumber}</td>
                            <td>
                                <div className="status status-blue before:hidden">
                                    {item.role}
                                </div>
                            </td>
                            <td>
                                <div
                                    className={`status ${
                                        item.status === "Pending"
                                            ? "status-yellow"
                                            : item.status === "Banned"
                                            ? "status-red"
                                            : "status-green"
                                    }`}
                                >
                                    {item.status}
                                </div>
                            </td>
                            <td className="w-33">
                                <div className="flex items-center gap-2">
                                    <Action isView />
                                    <Action
                                        onClick={() => {
                                            setIsModalOpen(true);
                                            setNewUser(false);
                                        }}
                                    />
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
            <Modal
                title={newUser ? "Add New User" : "Update User"}
                open={isModalOpen}
                onClose={() => {
                    setIsModalOpen(false);
                    setNewUser(false);
                }}
                isSlidePanel
                contentFooter={
                    <Button
                        className="min-w-30 max-md:flex-1 max-md:min-w-auto"
                        isPrimary
                        isMedium
                    >
                        {newUser ? "Add User" : "Update"}
                    </Button>
                }
            >
                <Details />
            </Modal>
            <ModalDelete
                content="Are you sure you want to delete this event?"
                open={isModalDeleteOpen}
                onClose={() => setIsModalDeleteOpen(false)}
                onDelete={() => setIsModalDeleteOpen(false)}
            />
        </>
    );
};

export default UsersPage;
