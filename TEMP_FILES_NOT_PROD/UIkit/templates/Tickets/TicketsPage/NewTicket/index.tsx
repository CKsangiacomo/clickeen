import { useState } from "react";
import Field from "@/components/Field";
import Select from "@/components/Select";
import { SelectOption } from "@/types/select";

const ticketNames = [
    { id: 0, name: "VIP" },
    { id: 1, name: "General" },
    { id: 2, name: "Early Bird" },
];

const salesStatuses = [
    { id: 0, name: "Active" },
    { id: 1, name: "Sold Out" },
];

const visibilityes = [
    { id: 0, name: "Public" },
    { id: 1, name: "Hidden" },
];

const NewTicket = ({}) => {
    const [name, setName] = useState<SelectOption>(ticketNames[0]);
    const [price, setPrice] = useState("");
    const [salesStatus, setSalesStatus] = useState<SelectOption>(
        salesStatuses[0]
    );
    const [visibility, setVisibility] = useState<SelectOption>(visibilityes[0]);

    return (
        <div className="flex flex-col gap-4">
            <Select
                label="Ticket Name"
                value={name}
                onChange={setName}
                options={ticketNames}
                required
            />
            <Field
                label="Price"
                placeholder="Enter price"
                type="tel"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                required
            />
            <Select
                label="Sales Status"
                value={salesStatus}
                onChange={setSalesStatus}
                options={salesStatuses}
                required
            />
            <Select
                label="Visibility"
                value={visibility}
                onChange={setVisibility}
                options={visibilityes}
                required
            />
        </div>
    );
};

export default NewTicket;
