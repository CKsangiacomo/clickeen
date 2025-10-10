import { useState } from "react";
import Field from "@/components/Field";
import Select from "@/components/Select";
import { SelectOption } from "@/types/select";

const roles = [
    { id: 0, name: "Admin" },
    { id: 1, name: "Organizer" },
    { id: 2, name: "Attendee" },
];

const Details = ({}) => {
    const [name, setName] = useState("");
    const [email, setEmail] = useState("");
    const [phone, setPhone] = useState("");
    const [password, setPassword] = useState("");
    const [role, setRole] = useState<SelectOption>(roles[0]);

    return (
        <div className="flex flex-col gap-4">
            <Field
                label="Name"
                placeholder="Enter name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
            />
            <Field
                label="Email Address"
                placeholder="Enter email address"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
            />
            <Field
                label="Phone Number"
                placeholder="Enter phone number"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                required
            />
            <Field
                label="Password"
                placeholder="Enter password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
            />
            <Select
                label="Role"
                className="min-w-14.5"
                value={role}
                onChange={setRole}
                options={roles}
                required
            />
        </div>
    );
};

export default Details;
