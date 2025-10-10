import { useState } from "react";
import Field from "@/components/Field";
import Select from "@/components/Select";
import { SelectOption } from "@/types/select";

const statuses = [
    { id: 0, name: "Active" },
    { id: 1, name: "Inactive" },
];

const AddNewCategory = ({}) => {
    const [name, setName] = useState("");
    const [slug, setSlug] = useState("");
    const [eventsCount, setEventsCount] = useState("");
    const [status, setStatus] = useState<SelectOption>(statuses[0]);

    return (
        <div className="flex flex-col gap-4">
            <Field
                label="Category Name"
                placeholder="Enter category name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
            />
            <Field
                label="Slug"
                placeholder="Enter slug"
                type="text"
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
                required
            />
            <Field
                label="Events Count"
                placeholder="Enter events count"
                type="number"
                value={eventsCount}
                onChange={(e) => setEventsCount(e.target.value)}
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

export default AddNewCategory;
