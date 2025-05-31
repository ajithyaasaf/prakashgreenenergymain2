import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2 } from "lucide-react";

// Extend the customer schema for frontend validation
const customerFormSchema = z.object({
  name: z.string().min(2, { message: "Name must be at least 2 characters" }),
  address: z.string().optional(),
  email: z.string().email({ message: "Please enter a valid email address" }).optional().or(z.literal("")),
  phone: z.string().optional(),
  location: z.string().optional(),
  scope: z.string().optional(),
});

type CustomerFormValues = z.infer<typeof customerFormSchema>;

interface CustomerFormProps {
  initialData?: CustomerFormValues & { id?: string };
  onSuccess: () => void;
  isEditing?: boolean;
}

export function CustomerForm({ initialData, onSuccess, isEditing = false }: CustomerFormProps) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const defaultValues: Partial<CustomerFormValues> = {
    name: "",
    address: "",
    email: "",
    phone: "",
    location: "",
    scope: "",
    ...initialData,
  };

  // Create/Update customer mutation with cache invalidation
  const customerMutation = useMutation({
    mutationFn: async (data: CustomerFormValues) => {
      const endpoint = isEditing 
        ? `/api/customers/${initialData?.id}` 
        : "/api/customers";
        
      const method = isEditing ? "PATCH" : "POST";
      return apiRequest(method, endpoint, data);
    },
    onSuccess: () => {
      // Invalidate all customer-related queries to refresh the UI
      queryClient.invalidateQueries({ 
        predicate: (query) => {
          const queryKey = query.queryKey[0];
          if (typeof queryKey === 'string') {
            return queryKey.includes('/api/customers') || queryKey.includes('/api/activity-logs');
          }
          return false;
        }
      });
      
      toast({
        title: `Customer ${isEditing ? "updated" : "created"} successfully`,
      });
      onSuccess();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to save customer",
        variant: "destructive",
      });
    }
  });

  const form = useForm<CustomerFormValues>({
    resolver: zodResolver(customerFormSchema),
    defaultValues,
  });

  const onSubmit = (data: CustomerFormValues) => {
    customerMutation.mutate(data);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{isEditing ? "Edit Customer" : "Add New Customer"}</CardTitle>
        <CardDescription>
          {isEditing 
            ? "Update customer information" 
            : "Fill in the details to add a new customer to your database."}
        </CardDescription>
      </CardHeader>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <CardContent className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Name <span className="text-destructive">*</span></FormLabel>
                  <FormControl>
                    <Input placeholder="Customer or company name" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="address"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Address</FormLabel>
                  <FormControl>
                    <Textarea 
                      placeholder="Full address" 
                      className="min-h-[100px]" 
                      {...field} 
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input placeholder="Email address" type="email" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Phone</FormLabel>
                    <FormControl>
                      <Input placeholder="Phone number" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            
            <FormField
              control={form.control}
              name="location"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Location</FormLabel>
                  <FormControl>
                    <Input placeholder="City, State" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="scope"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Customer Scope</FormLabel>
                  <FormControl>
                    <Textarea 
                      placeholder="Description of projects, requirements, etc." 
                      className="min-h-[100px]" 
                      {...field} 
                    />
                  </FormControl>
                  <FormDescription>
                    Provide details about their business needs and requirements.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
          <CardFooter className="flex justify-between">
            <Button 
              type="button" 
              variant="outline" 
              onClick={() => onSuccess()}
            >
              Cancel
            </Button>
            <Button 
              type="submit" 
              className="bg-primary hover:bg-primary-dark text-white"
              disabled={customerMutation.isPending}
            >
              {customerMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                isEditing ? "Update Customer" : "Add Customer"
              )}
            </Button>
          </CardFooter>
        </form>
      </Form>
    </Card>
  );
}
