"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

export function ManualAddressForm({
  initialAddress = ""
}: {
  initialAddress?: string;
}) {
  const router = useRouter();
  const [address, setAddress] = useState(initialAddress);
  const [budgetOrPrice, setBudgetOrPrice] = useState("");
  const [roomCount, setRoomCount] = useState("");
  const [bathroomCount, setBathroomCount] = useState("");
  const [spaceEstimate, setSpaceEstimate] = useState("");

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    const params = new URLSearchParams();
    params.set("address", address);
    if (budgetOrPrice) params.set("price", budgetOrPrice);
    if (roomCount) params.set("beds", roomCount);
    if (bathroomCount) params.set("baths", bathroomCount);
    if (spaceEstimate) params.set("squareFeet", spaceEstimate);
    router.push(`/evaluate?${params.toString()}`);
  }

  return (
    <Card className="p-6">
      <form onSubmit={onSubmit} className="space-y-4">
        <label className="block space-y-2">
          <span className="text-sm text-gray-600">Location address or place</span>
          <Input
            value={address}
            onChange={(event) => setAddress(event.target.value)}
            placeholder="65 Greene Ave, Brooklyn, NY 11238"
          />
        </label>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <label className="space-y-2">
            <span className="text-sm text-gray-600">Budget or price</span>
            <Input value={budgetOrPrice} onChange={(event) => setBudgetOrPrice(event.target.value)} />
          </label>
          <label className="space-y-2">
            <span className="text-sm text-gray-600">Bedrooms or rooms</span>
            <Input value={roomCount} onChange={(event) => setRoomCount(event.target.value)} />
          </label>
          <label className="space-y-2">
            <span className="text-sm text-gray-600">Bathrooms</span>
            <Input value={bathroomCount} onChange={(event) => setBathroomCount(event.target.value)} />
          </label>
          <label className="space-y-2">
            <span className="text-sm text-gray-600">Space estimate</span>
            <Input
              value={spaceEstimate}
              onChange={(event) => setSpaceEstimate(event.target.value)}
            />
          </label>
        </div>
        <Button type="submit">Analyze this location</Button>
      </form>
    </Card>
  );
}
