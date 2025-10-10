import { useState } from "react";
import UploadImage from "@/components/UploadImage";
import Field from "@/components/Field";

const CreateEvent = ({}) => {
    const [title, setTitle] = useState("");
    const [images, setImages] = useState<File[]>([]);
    const [description, setDescription] = useState("");
    const [location, setLocation] = useState("");
    const [date, setDate] = useState("");

    const handleChange = (file: File) => {
        setImages([...images, file]);
    };

    return (
        <div className="flex flex-col gap-4">
            <UploadImage label="Thumbnail" onChange={handleChange} required />
            <Field
                label="Title"
                placeholder="Enter title"
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
            />
            <Field
                label="Description"
                placeholder="Enter description"
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                required
                textarea
            />
            <Field
                label="Location"
                placeholder="Enter location"
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                required
            />
            <Field
                label="Date"
                placeholder="Enter date"
                type="text"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                required
            />
        </div>
    );
};

export default CreateEvent;
