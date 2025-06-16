import { Card, CardContent, CardHeader, CardTitle } from "@workspace/ui/components/card";
import { Button } from "@workspace/ui/components/button";
import { Clock, Trophy, Calendar, Gamepad2 } from "lucide-react";
import Link from "next/link";
import { getCategories } from "./_actions";

export default async function CategoriesPage() {
    const categories = await getCategories();

    return (
        <div className="flex flex-col gap-4 p-8">
            <Card>
                <CardHeader>
                    <CardTitle>Vehicle Categories</CardTitle>
                    <p className="text-sm text-muted-foreground">
                        Racing categories where you&apos;ve recorded lap times
                    </p>
                </CardHeader>
                <CardContent>
                    {categories.length === 0 ? (
                        <p className="text-muted-foreground">No categories found. Start a racing session to see your categories here.</p>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {categories.map((category, index) => (
                                <Card key={`${category.class_name}-${index}`} className="hover:shadow-md transition-shadow">
                                    <CardHeader className="pb-3">
                                        <CardTitle className="flex items-center gap-2">
                                            <Trophy className="h-5 w-5" />
                                            {category.class_name || "Unknown Category"}
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent className="space-y-4">
                                        <div className="space-y-2">
                                            <div className="flex items-center gap-2">
                                                <Gamepad2 className="h-4 w-4" />
                                                <span className="text-sm font-medium">
                                                    {category.sessions?.sim_name || "Unknown Sim"}
                                                </span>
                                            </div>
                                            
                                            <div className="flex items-center gap-1 text-sm text-muted-foreground">
                                                <Clock className="h-4 w-4" />
                                                <span>{category._count.laps} laps recorded</span>
                                            </div>
                                            
                                            <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                                <Calendar className="h-3 w-3" />
                                                <span>
                                                    Last session: {category.sessions?.created_at ? new Date(category.sessions.created_at).toLocaleDateString() : 'Unknown'}
                                                </span>
                                            </div>
                                        </div>
                                        
                                        <div className="flex gap-2 pt-2 border-t">
                                            <Button asChild size="sm" className="flex-1">
                                                <Link href={`/laps/categories/${category.id}`}>
                                                    View Laps
                                                </Link>
                                            </Button>
                                        </div>
                                    </CardContent>
                                </Card>
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}