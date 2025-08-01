/**
 * Site Visit Photo Upload Component
 * Allows adding photos to an ongoing site visit
 */

import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { 
  Camera, 
  Upload,
  X,
  CheckCircle,
  RotateCcw
} from "lucide-react";

interface PhotoUpload {
  data: string; // base64 data instead of File
  preview: string;
  description: string;
}

interface SiteVisitPhotoUploadProps {
  siteVisitId: string;
}

export function SiteVisitPhotoUpload({ siteVisitId }: SiteVisitPhotoUploadProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [photos, setPhotos] = useState<PhotoUpload[]>([]);
  
  // Camera states
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [isVideoReady, setIsVideoReady] = useState(false);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [currentCamera, setCurrentCamera] = useState<'front' | 'back'>('back');
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const handlePhotoSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files) return;

    Array.from(files).forEach(file => {
      if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = (e) => {
          setPhotos(prev => [...prev, {
            file,
            preview: e.target?.result as string,
            description: ''
          }]);
        };
        reader.readAsDataURL(file);
      }
    });

    // Reset the input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const removePhoto = (index: number) => {
    setPhotos(prev => prev.filter((_, i) => i !== index));
  };

  const updatePhotoDescription = (index: number, description: string) => {
    setPhotos(prev => prev.map((photo, i) => 
      i === index ? { ...photo, description } : photo
    ));
  };

  const uploadPhotosMutation = useMutation({
    mutationFn: async () => {
      // Upload photos to Cloudinary first
      const uploadedPhotos = [];
      
      for (const photo of photos) {
        try {
          // Convert file to base64 for server upload
          const reader = new FileReader();
          const base64Promise = new Promise<string>((resolve, reject) => {
            reader.onload = () => resolve(reader.result as string);
            reader.onerror = reject;
            reader.readAsDataURL(photo.file);
          });
          
          const base64Data = await base64Promise;
          
          const uploadResponse = await apiRequest('/api/attendance/upload-photo', 'POST', {
            imageData: base64Data,
            userId: `site_visit_${siteVisitId}`, // Use site visit ID for organization
            attendanceType: 'site_visit_additional'
          });

          if (!uploadResponse.ok) {
            const errorData = await uploadResponse.json();
            throw new Error(errorData.message || 'Photo upload failed');
          }

          const uploadResult = await uploadResponse.json();
          uploadedPhotos.push({
            url: uploadResult.url,
            timestamp: new Date(),
            description: photo.description || 'Site visit photo'
          });
        } catch (error) {
          console.error('Photo upload failed:', error);
          throw error;
        }
      }

      // Add photos to site visit
      return apiRequest(`/api/site-visits/${siteVisitId}/photos`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          photos: uploadedPhotos
        }),
      });
    },
    onSuccess: () => {
      toast({
        title: "Photos Uploaded",
        description: `${photos.length} photo(s) added to site visit`,
      });
      setPhotos([]);
      queryClient.invalidateQueries({ queryKey: ['/api/site-visits'] });
    },
    onError: (error: any) => {
      toast({
        title: "Upload Failed",
        description: error.message || "Failed to upload photos",
        variant: "destructive",
      });
    },
  });

  const handleUpload = () => {
    if (photos.length === 0) {
      toast({
        title: "No Photos Selected",
        description: "Please select photos to upload",
        variant: "destructive",
      });
      return;
    }

    uploadPhotosMutation.mutate();
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Camera className="h-5 w-5" />
          Add Photos to Visit
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            onChange={handlePhotoSelect}
            className="hidden"
          />
          <Button 
            onClick={() => fileInputRef.current?.click()}
            variant="outline"
            className="w-full"
          >
            <Upload className="h-4 w-4 mr-2" />
            Select Photos
          </Button>
        </div>

        {photos.length > 0 && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {photos.map((photo, index) => (
                <div key={index} className="space-y-2">
                  <div className="relative">
                    <img
                      src={photo.preview}
                      alt={`Photo ${index + 1}`}
                      className="w-full h-32 object-cover rounded-lg"
                    />
                    <Button
                      size="sm"
                      variant="destructive"
                      className="absolute top-2 right-2 h-6 w-6 p-0"
                      onClick={() => removePhoto(index)}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                  <Textarea
                    placeholder="Photo description (optional)"
                    value={photo.description}
                    onChange={(e) => updatePhotoDescription(index, e.target.value)}
                    rows={2}
                    className="text-sm"
                  />
                </div>
              ))}
            </div>

            <Button
              onClick={handleUpload}
              disabled={uploadPhotosMutation.isPending}
              className="w-full"
            >
              {uploadPhotosMutation.isPending ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Uploading...
                </>
              ) : (
                <>
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Upload {photos.length} Photo(s)
                </>
              )}
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}