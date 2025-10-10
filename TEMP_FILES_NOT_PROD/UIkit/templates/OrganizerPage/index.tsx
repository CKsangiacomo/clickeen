"use client";

import { useState } from "react";
import Layout from "@/components/Layout";
import Breadcrumbs from "@/components/Breadcrumbs";
import Button from "@/components/Button";
import Cards from "@/components/Cards";
import Modal from "@/components/Modal";
import CreateEvent from "@/components/CreateEvent";
import SalesAnalytics from "./SalesAnalytics";
import UpcomingEvents from "./UpcomingEvents";
import DeadlineAndCalendar from "./DeadlineAndCalendar";

import { stats } from "./stats";

const OrganizerPage = () => {
    const [isModalOpen, setIsModalOpen] = useState(false);

    return (
        <>
            <Layout title="Calendars">
                <Breadcrumbs items={["Home", "Calendars"]}>
                    <div className="flex gap-3">
                        <Button className="max-md:flex-1" isSecondary isMedium>
                            Generate Reports
                        </Button>
                        <Button
                            className="max-md:flex-1"
                            isPrimary
                            isMedium
                            onClick={() => setIsModalOpen(true)}
                        >
                            Create Event
                        </Button>
                    </div>
                </Breadcrumbs>
                <Cards items={stats} />
                <div className="flex items-start gap-6 mt-6 max-lg:block">
                    <div className="grow">
                        <SalesAnalytics />
                        <UpcomingEvents />
                    </div>
                    <DeadlineAndCalendar />
                </div>
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

export default OrganizerPage;
