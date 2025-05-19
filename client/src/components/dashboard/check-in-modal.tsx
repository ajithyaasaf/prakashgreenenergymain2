import { useState, useEffect } from "react";
import { format } from "date-fns";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle,
  DialogFooter,
  DialogClose
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { MapPin, FileText, UserCircle, LogIn } from "lucide-react";

interface CheckInModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CheckInModal({ open, onOpenChange }: CheckInModalProps) {
  const [location, setLocation] = useState("office");
  const [customer, setCustomer] = useState("");
  const [reason, setReason] = useState("");
  const [currentTime, setCurrentTime] = useState(new Date());

  // Update current time every minute
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(new Date());
    }, 60000);
    
    return () => clearInterval(interval);
  }, []);

  const handleSubmit = () => {
    // Handle check-in logic here
    console.log({ location, customer, reason });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Check-In</DialogTitle>
        </DialogHeader>
        
        <div className="mb-4">
          <p className="text-sm text-gray-500 mb-2">
            Current Time: <span className="font-medium">{format(currentTime, "hh:mm a")}</span>
          </p>
          <p className="text-sm text-gray-500">
            Current Date: <span className="font-medium">{format(currentTime, "MMMM dd, yyyy")}</span>
          </p>
        </div>
        
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="location">Location</Label>
            <Select value={location} onValueChange={setLocation}>
              <SelectTrigger id="location" className="w-full pl-10">
                <MapPin className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <SelectValue placeholder="Select location" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="office">Office</SelectItem>
                <SelectItem value="field">Field/Customer Site</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          {location === "field" && (
            <>
              <div className="space-y-2">
                <Label htmlFor="customer">Customer</Label>
                <Select value={customer} onValueChange={setCustomer}>
                  <SelectTrigger id="customer" className="w-full pl-10">
                    <UserCircle className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                    <SelectValue placeholder="Select a customer" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">Sundar Designs, Chennai</SelectItem>
                    <SelectItem value="2">Vijay Tech Solutions, Bangalore</SelectItem>
                    <SelectItem value="3">Ramesh Properties, Hyderabad</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="reason">Reason for Visit</Label>
                <div className="relative">
                  <Textarea 
                    id="reason" 
                    rows={3} 
                    className="pl-10" 
                    value={reason} 
                    onChange={(e) => setReason(e.target.value)}
                  />
                  <FileText className="absolute top-3 left-3 h-4 w-4 text-gray-400" />
                </div>
              </div>
            </>
          )}
        </div>
        
        <DialogFooter className="sm:justify-end">
          <DialogClose asChild>
            <Button type="button" variant="secondary">
              Cancel
            </Button>
          </DialogClose>
          <Button type="button" onClick={handleSubmit} className="bg-primary hover:bg-primary-dark">
            <LogIn className="mr-2 h-4 w-4" />
            Check In
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
