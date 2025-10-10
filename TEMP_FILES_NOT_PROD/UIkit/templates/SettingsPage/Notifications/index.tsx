import { useState } from "react";
import Switch from "@/components/Switch";
import Item from "../Item";

const Notifications = ({}) => {
    const [pushNotifications, setPushNotifications] = useState([
        {
            id: 0,
            title: "Transaction Confirmation",
            description:
                "Sent automatically to the customer after they place their order.",
            value: true,
            onChange: (value: boolean) =>
                handlePushNotificationsChange(0, value),
        },
        {
            id: 1,
            title: "Transaction Edited",
            description:
                "Sent to the customer after their order is edited (if you select this option).",
            value: false,
            onChange: (value: boolean) =>
                handlePushNotificationsChange(1, value),
        },
        {
            id: 2,
            title: "Transaction Invoice",
            description:
                "Sent to the customer when the order has an outstanding balance.",
            value: true,
            onChange: (value: boolean) =>
                handlePushNotificationsChange(2, value),
        },
        {
            id: 3,
            title: "Transaction Cancelled",
            description:
                "Sent automatically to the customer if their order is cancelled (if you select this option).",
            value: true,
            onChange: (value: boolean) =>
                handlePushNotificationsChange(3, value),
        },
        {
            id: 4,
            title: "Transaction Refund",
            description:
                "Sent automatically to the customer if their order is refunded (if you select this option).",
            value: true,
            onChange: (value: boolean) =>
                handlePushNotificationsChange(4, value),
        },
        {
            id: 5,
            title: "Payment Error",
            description:
                "Sent automatically to the customer if their payment can’t be processed during checkout.",
            value: false,
            onChange: (value: boolean) =>
                handlePushNotificationsChange(5, value),
        },
    ]);

    const handlePushNotificationsChange = (id: number, value: boolean) => {
        setPushNotifications((prev) =>
            prev.map((item) => (item.id === id ? { ...item, value } : item))
        );
    };

    return (
        <Item
            title="Push Notifications"
            description="Get alerts for new orders, order processingupdates, and when orders are completed or canceled."
        >
            <div className="flex flex-col gap-4 max-md:gap-0">
                {pushNotifications.map((item) => (
                    <div
                        className="flex justify-between items-center gap-4 py-4"
                        key={item.id}
                    >
                        <div className="">
                            <div className="font-semibold">{item.title}</div>
                            <div className="mt-1 text-body-sm font-medium text-gray-500">
                                {item.description}
                            </div>
                        </div>
                        <Switch checked={item.value} onChange={item.onChange} />
                    </div>
                ))}
            </div>
        </Item>
    );
};

export default Notifications;
