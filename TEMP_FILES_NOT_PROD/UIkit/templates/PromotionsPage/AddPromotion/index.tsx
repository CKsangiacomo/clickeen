import { useState } from "react";
import Field from "@/components/Field";
import Select from "@/components/Select";
import { SelectOption } from "@/types/select";

const usedes = [
    { id: 0, name: "Unlimited" },
    { id: 1, name: "Limited" },
];

const statuses = [
    { id: 0, name: "Active" },
    { id: 1, name: "Inactive" },
];

const AddPromotion = ({}) => {
    const [code, setCode] = useState("");
    const [discount, setDiscount] = useState("");
    const [used, setUsed] = useState<SelectOption>(usedes[0]);
    const [status, setStatus] = useState<SelectOption>(statuses[0]);

    return (
        <div className="flex flex-col gap-4">
            <Field
                label="Code"
                placeholder="Enter code"
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                required
            />
            <Field
                label="Discount"
                placeholder="Enter discount"
                type="text"
                value={discount}
                onChange={(e) => setDiscount(e.target.value)}
                required
            />
            <Select
                label="Used"
                value={used}
                onChange={setUsed}
                options={usedes}
                required
            />
            <Select
                label="Status"
                value={status}
                onChange={setStatus}
                options={statuses}
                required
            />
        </div>
    );
};

export default AddPromotion;
