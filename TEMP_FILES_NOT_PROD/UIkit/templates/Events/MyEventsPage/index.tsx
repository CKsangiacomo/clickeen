"use client";

import { useState } from "react";
import Layout from "@/components/Layout";
import Breadcrumbs from "@/components/Breadcrumbs";
import Button from "@/components/Button";
import Cards from "@/components/Cards";
import Modal from "@/components/Modal";
import CreateEvent from "@/components/CreateEvent";
import EventsTable from "./EventsTable";

import { stats } from "./stats";

const MyEventsPage = () => {
    const [isModalOpen, setIsModalOpen] = useState(false);
    return (
        <>
            <Layout title="My Events">
                <Breadcrumbs items={["Management", "My Events"]}>
                    <Button
                        className="max-md:w-full"
                        isPrimary
                        isMedium
                        onClick={() => setIsModalOpen(true)}
                    >
                        Create Event
                    </Button>
                </Breadcrumbs>
                <Cards items={stats} />
                <EventsTable />
            </Layout>
            <Modal
                title="Create New Event"
                open={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                isSlidePanel
                contentFooter={
                    <Button className="min-w-30" isPrimary isMedium>
                        Create
                    </Button>
                }
            >
                <CreateEvent />
            </Modal>
        </>
    );
};

export default MyEventsPage;
