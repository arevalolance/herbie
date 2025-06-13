import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"
import { Label } from "@workspace/ui/components/label"
import { getSignUpUrl } from '@workos-inc/authkit-nextjs'
import { WorkOS } from '@workos-inc/node'
import { redirect } from 'next/navigation'
import Link from 'next/link'

const workos = new WorkOS(process.env.WORKOS_API_KEY)

async function signUpWithEmail(formData: FormData) {
    'use server'
    
    const email = formData.get('email') as string
    
    // For email/password registration, redirect to WorkOS AuthKit with email hint
    const signUpUrl = await getSignUpUrl({ 
        loginHint: email
    })
    
    redirect(signUpUrl)
}

async function signUpWithGoogle() {
    'use server'
    
    const googleOAuthUrl = workos.userManagement.getAuthorizationUrl({
        clientId: process.env.WORKOS_CLIENT_ID || '',
        provider: 'GoogleOAuth',
        redirectUri: `${process.env.NEXT_PUBLIC_WORKOS_REDIRECT_URI}`,
    })
    
    redirect(googleOAuthUrl)
}

export default function SignUpPage() {
    return (
        <div className="flex flex-col gap-6">
            <div className="flex flex-col items-center text-center">
                <h1 className="text-2xl font-bold">Create your account</h1>
                <p className="text-muted-foreground text-balance">
                    Sign up to get started
                </p>
            </div>
            <form action={signUpWithEmail} className="flex flex-col gap-6">
                <div className="grid gap-3">
                    <Label htmlFor="email">Email</Label>
                    <Input
                        id="email"
                        name="email"
                        type="email"
                        placeholder="m@example.com"
                        required
                    />
                </div>
                <div className="grid gap-3">
                    <Label htmlFor="password">Password</Label>
                    <Input 
                        id="password" 
                        name="password" 
                        type="password" 
                        required 
                    />
                </div>
                <Button type="submit" className="w-full">
                    Sign up
                </Button>
            </form>
            <div className="after:border-border relative text-center text-sm after:absolute after:inset-0 after:top-1/2 after:z-0 after:flex after:items-center after:border-t">
                <span className="bg-card text-muted-foreground relative z-10 px-2">
                    Or continue with
                </span>
            </div>
            <div className="grid grid-cols-1 gap-4">
                <form action={signUpWithGoogle}>
                    <Button variant="outline" type="submit" className="w-full">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
                            <path
                                d="M12.48 10.92v3.28h7.84c-.24 1.84-.853 3.187-1.787 4.133-1.147 1.147-2.933 2.4-6.053 2.4-4.827 0-8.6-3.893-8.6-8.72s3.773-8.72 8.6-8.72c2.6 0 4.507 1.027 5.907 2.347l2.307-2.307C18.747 1.44 16.133 0 12.48 0 5.867 0 .307 5.387.307 12s5.56 12 12.173 12c3.573 0 6.267-1.173 8.373-3.36 2.16-2.16 2.84-5.213 2.84-7.667 0-.76-.053-1.467-.173-2.053H12.48z"
                                fill="currentColor"
                            />
                        </svg>
                        <span className="ml-2">Continue with Google</span>
                    </Button>
                </form>
            </div>
            <div className="text-center text-sm">
                Already have an account?{" "}
                <Link href="/sign-in" className="underline underline-offset-4">
                    Sign in
                </Link>
            </div>
        </div>
    )
} 