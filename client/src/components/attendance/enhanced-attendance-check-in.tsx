import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuthContext } from "@/contexts/auth-context";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Camera, Clock, MapPin, Loader2, AlertTriangle, CheckCircle, Upload } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";

interface EnhancedCheckInProps {
  onSuccess: () => void;
  onClose: () => void;
  isOpen: boolean;
  departmentTiming: any;
}

export function EnhancedAttendanceCheckIn({ onSuccess, onClose, isOpen, departmentTiming }: EnhancedCheckInProps) {
  const { user } = useAuthContext();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // State management
  const [step, setStep] = useState<"location" | "early_detection" | "capture" | "processing">("location");
  const [attendanceType, setAttendanceType] = useState<string>("office");
  const [reason, setReason] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string>("");
  const [location, setLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [locationError, setLocationError] = useState<string>("");
  const [isEarlyCheckIn, setIsEarlyCheckIn] = useState(false);
  const [earlyCheckInMinutes, setEarlyCheckInMinutes] = useState(0);
  const [isLoadingLocation, setIsLoadingLocation] = useState(false);

  // Check for early check-in when component opens
  useEffect(() => {
    if (isOpen && departmentTiming?.checkInTime) {
      checkEarlyLogin();
    }
  }, [isOpen, departmentTiming]);

  const checkEarlyLogin = () => {
    if (!departmentTiming?.checkInTime) return;

    const now = new Date();
    const [checkInHour, checkInMinute] = departmentTiming.checkInTime.split(':').map(Number);
    
    const expectedCheckInTime = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
      checkInHour,
      checkInMinute
    );

    const isEarly = now < expectedCheckInTime;
    if (isEarly) {
      const minutesEarly = Math.floor((expectedCheckInTime.getTime() - now.getTime()) / (1000 * 60));
      setIsEarlyCheckIn(true);
      setEarlyCheckInMinutes(minutesEarly);
      setStep("early_detection");
    } else {
      setIsEarlyCheckIn(false);
      setStep("location");
    }
  };

  // Get current location
  const getCurrentLocation = async () => {
    setIsLoadingLocation(true);
    setLocationError("");

    try {
      if (!navigator.geolocation) {
        throw new Error("Geolocation is not supported by this browser");
      }

      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 60000
        });
      });

      setLocation({
        latitude: position.coords.latitude,
        longitude: position.coords.longitude
      });

      setStep(isEarlyCheckIn ? "capture" : "processing");
    } catch (error: any) {
      setLocationError(error.message || "Failed to get location");
    } finally {
      setIsLoadingLocation(false);
    }
  };

  // Handle image capture/upload
  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImageFile(file);
      const reader = new FileReader();
      reader.onload = (e) => {
        setImagePreview(e.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  // Upload image to Cloudinary
  const uploadImage = async (file: File): Promise<string> => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('upload_preset', 'attendance_images');

    const response = await fetch(
      'https://api.cloudinary.com/v1_1/your-cloud-name/image/upload',
      {
        method: 'POST',
        body: formData,
      }
    );

    if (!response.ok) {
      throw new Error('Failed to upload image');
    }

    const data = await response.json();
    return data.secure_url;
  };

  // Enhanced check-in mutation
  const checkInMutation = useMutation({
    mutationFn: async () => {
      if (!location) {
        throw new Error("Location is required");
      }

      let imageUrl = "";
      if (imageFile) {
        imageUrl = await uploadImage(imageFile);
      }

      const response = await apiRequest('/api/attendance/enhanced-check-in', 'POST', {
        latitude: location.latitude.toString(),
        longitude: location.longitude.toString(),
        attendanceType,
        reason: isEarlyCheckIn ? reason : undefined,
        imageUrl: isEarlyCheckIn ? imageUrl : undefined,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Check-in failed');
      }

      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Check-in Successful",
        description: data.message,
        variant: "default"
      });
      
      queryClient.invalidateQueries({ queryKey: ["/api/attendance"] });
      queryClient.invalidateQueries({ queryKey: ["/api/attendance/today"] });
      
      onSuccess();
      onClose();
      resetForm();
    },
    onError: (error: any) => {
      toast({
        title: "Check-in Failed",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  const resetForm = () => {
    setStep("location");
    setAttendanceType("office");
    setReason("");
    setImageFile(null);
    setImagePreview("");
    setLocation(null);
    setLocationError("");
    setIsEarlyCheckIn(false);
    setEarlyCheckInMinutes(0);
  };

  const handleClose = () => {
    if (!checkInMutation.isPending) {
      resetForm();
      onClose();
    }
  };

  const canProceedToCheckIn = () => {
    if (!location) return false;
    if (isEarlyCheckIn) {
      return reason.trim().length > 0 && imageFile !== null;
    }
    return true;
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CheckCircle className="h-5 w-5 text-green-600" />
            Enhanced Check-In
            {isEarlyCheckIn && (
              <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-200">
                Early Login Detected
              </Badge>
            )}
          </DialogTitle>
          <DialogDescription>
            {step === "early_detection" && "Early check-in detected - additional information required"}
            {step === "location" && "Get your location to proceed with check-in"}
            {step === "capture" && "Capture photo and provide reason for early check-in"}
            {step === "processing" && "Processing your check-in..."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Early Check-in Detection */}
          {step === "early_detection" && (
            <Card className="border-orange-200 bg-orange-50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-orange-800">
                  <AlertTriangle className="h-5 w-5" />
                  Early Check-in Detected
                </CardTitle>
                <CardDescription className="text-orange-700">
                  You are checking in {earlyCheckInMinutes} minutes before your scheduled time of{" "}
                  {departmentTiming?.checkInTime}. Please provide a reason and capture a photo.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="font-medium">Expected Check-in:</span>
                    <div className="text-orange-700">{departmentTiming?.checkInTime}</div>
                  </div>
                  <div>
                    <span className="font-medium">Current Time:</span>
                    <div className="text-orange-700">{new Date().toLocaleTimeString('en-IN', { 
                      hour: '2-digit', 
                      minute: '2-digit', 
                      hour12: true 
                    })}</div>
                  </div>
                </div>
                <Button 
                  onClick={() => setStep("location")} 
                  className="w-full mt-4"
                >
                  Continue with Early Check-in
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Location Step */}
          {step === "location" && (
            <div className="space-y-4">
              <div>
                <Label>Attendance Type</Label>
                <Select value={attendanceType} onValueChange={setAttendanceType}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="office">Office Work</SelectItem>
                    <SelectItem value="remote">Remote Work</SelectItem>
                    <SelectItem value="field_work">Field Work</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <MapPin className="h-5 w-5" />
                    Location Required
                  </CardTitle>
                  <CardDescription>
                    We need your current location for attendance verification
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {location ? (
                    <div className="text-sm text-green-600 flex items-center gap-2">
                      <CheckCircle className="h-4 w-4" />
                      Location captured successfully
                    </div>
                  ) : (
                    <Button 
                      onClick={getCurrentLocation} 
                      disabled={isLoadingLocation}
                      className="w-full"
                    >
                      {isLoadingLocation ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Getting Location...
                        </>
                      ) : (
                        <>
                          <MapPin className="h-4 w-4 mr-2" />
                          Get Current Location
                        </>
                      )}
                    </Button>
                  )}
                  {locationError && (
                    <div className="text-sm text-red-600 mt-2">{locationError}</div>
                  )}
                </CardContent>
              </Card>

              {location && !isEarlyCheckIn && (
                <Button 
                  onClick={() => setStep("processing")} 
                  className="w-full"
                >
                  Proceed to Check-in
                </Button>
              )}

              {location && isEarlyCheckIn && (
                <Button 
                  onClick={() => setStep("capture")} 
                  className="w-full"
                >
                  Continue to Photo & Reason
                </Button>
              )}
            </div>
          )}

          {/* Photo and Reason Capture (for early check-in) */}
          {step === "capture" && isEarlyCheckIn && (
            <div className="space-y-4">
              <div>
                <Label htmlFor="reason">Reason for Early Check-in *</Label>
                <Textarea
                  id="reason"
                  placeholder="Please explain why you are checking in early..."
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  rows={3}
                />
              </div>

              <div>
                <Label htmlFor="image">Photo Required *</Label>
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
                  {imagePreview ? (
                    <div className="space-y-2">
                      <img 
                        src={imagePreview} 
                        alt="Preview" 
                        className="mx-auto max-h-32 rounded"
                      />
                      <Button variant="outline" onClick={() => {
                        setImageFile(null);
                        setImagePreview("");
                      }}>
                        Change Photo
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <Camera className="h-8 w-8 mx-auto text-gray-400" />
                      <div className="text-sm text-gray-600">
                        Click to capture or upload photo
                      </div>
                      <Input
                        id="image"
                        type="file"
                        accept="image/*"
                        capture="environment"
                        onChange={handleImageChange}
                        className="hidden"
                      />
                      <Button 
                        variant="outline" 
                        onClick={() => document.getElementById('image')?.click()}
                      >
                        <Upload className="h-4 w-4 mr-2" />
                        Select Photo
                      </Button>
                    </div>
                  )}
                </div>
              </div>

              <Button 
                onClick={() => setStep("processing")} 
                disabled={!canProceedToCheckIn()}
                className="w-full"
              >
                Complete Early Check-in
              </Button>
            </div>
          )}

          {/* Processing Step */}
          {step === "processing" && (
            <div className="space-y-4">
              <Card>
                <CardContent className="pt-6">
                  <div className="text-center space-y-4">
                    <div className="text-lg font-semibold">Ready to Check-in</div>
                    <div className="text-sm text-gray-600 space-y-1">
                      <div>Type: {attendanceType.replace('_', ' ')}</div>
                      <div>Time: {new Date().toLocaleTimeString('en-IN', { 
                        hour: '2-digit', 
                        minute: '2-digit', 
                        hour12: true 
                      })}</div>
                      {isEarlyCheckIn && (
                        <div className="text-orange-600">
                          Early check-in ({earlyCheckInMinutes} minutes early)
                        </div>
                      )}
                    </div>
                    
                    <Button 
                      onClick={() => checkInMutation.mutate()}
                      disabled={checkInMutation.isPending}
                      className="w-full"
                    >
                      {checkInMutation.isPending ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Processing Check-in...
                        </>
                      ) : (
                        <>
                          <Clock className="h-4 w-4 mr-2" />
                          Complete Check-in
                        </>
                      )}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}