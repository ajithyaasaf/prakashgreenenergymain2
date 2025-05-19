import { ReactNode } from "react";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Leaf } from "lucide-react";

interface AuthFormProps {
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
}

export function AuthForm({ title, description, children, footer }: AuthFormProps) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50 p-4 sm:p-6">
      <div className="mb-6 flex items-center gap-2">
        <div className="h-10 w-10 rounded-md bg-primary flex items-center justify-center">
          <Leaf className="h-6 w-6 text-white" />
        </div>
        <span className="text-2xl font-bold">Prakash Greens Energy</span>
      </div>
      
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-xl">{title}</CardTitle>
          {description && <CardDescription>{description}</CardDescription>}
        </CardHeader>
        <CardContent>
          {children}
        </CardContent>
        {footer && (
          <CardFooter className="border-t bg-gray-50/50 px-6 py-4">
            {footer}
          </CardFooter>
        )}
      </Card>
    </div>
  );
}
