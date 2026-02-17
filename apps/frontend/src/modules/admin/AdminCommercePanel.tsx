import React, { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from '@/components/ui/dialog';
import axios from 'axios';
import { Plus, Edit, Trash } from 'lucide-react';

interface AdminProduct {
    id: string;
    name: string;
    description: string;
    price: number; // For simplicity in UI state (from prices array)
    ai_tokens: number;
    features: string[];
    isPublic: boolean;
    stripeProductId?: string;
}

export const AdminCommercePanel: React.FC = () => {
    const [products, setProducts] = useState<AdminProduct[]>([]);
    const [selectedProduct, setSelectedProduct] = useState<Partial<AdminProduct>>({});
    const [isEditOpen, setIsEditOpen] = useState(false);

    const fetchProducts = async () => {
        const res = await axios.get('/api/commerce/admin/products');
        // Transform backend entities to simplified UI model
        const mapped = res.data.map((p: any) => ({
            id: p.id,
            name: p.name,
            description: p.description,
            price: p.prices.find((pr: any) => pr.interval === 'month')?.amount || 0,
            ai_tokens: p.metadata.ai_tokens,
            features: p.features || [],
            isPublic: p.isPublic,
            stripeProductId: p.stripeProductId
        }));
        setProducts(mapped);
    };

    useEffect(() => {
        fetchProducts();
    }, []);

    const handleSave = async () => {
        try {
            const payload = {
                name: selectedProduct.name,
                description: selectedProduct.description,
                metadata: { ai_tokens: selectedProduct.ai_tokens },
                features: selectedProduct.features,
                isPublic: selectedProduct.isPublic,
                priceAmount: selectedProduct.price
            };

            if (selectedProduct.id) {
                await axios.put(`/api/commerce/admin/products/${selectedProduct.id}`, payload);
            } else {
                await axios.post('/api/commerce/admin/products', payload);
            }
            setIsEditOpen(false);
            fetchProducts();
        } catch (err) {
            console.error('Save failed', err);
            alert('Failed to save product');
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h2 className="text-3xl font-bold">Package Management</h2>
                <Button onClick={() => { setSelectedProduct({}); setIsEditOpen(true); }}>
                    <Plus className="mr-2 h-4 w-4" /> New Package
                </Button>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Active Packages</CardTitle>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Name</TableHead>
                                <TableHead>Price (Mo)</TableHead>
                                <TableHead>Limit</TableHead>
                                <TableHead>Public</TableHead>
                                <TableHead>Synced</TableHead>
                                <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {products.map((product) => (
                                <TableRow key={product.id}>
                                    <TableCell className="font-medium">{product.name}</TableCell>
                                    <TableCell>${product.price}</TableCell>
                                    <TableCell>{product.ai_tokens.toLocaleString()}</TableCell>
                                    <TableCell>{product.isPublic ? 'Yes' : 'No'}</TableCell>
                                    <TableCell>
                                        <Badge variant={product.stripeProductId ? 'default' : 'destructive'}>
                                            {product.stripeProductId ? 'Synced' : 'Local Only'}
                                        </Badge>
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <Button variant="ghost" size="sm" onClick={() => { setSelectedProduct(product); setIsEditOpen(true); }}>
                                            <Edit className="h-4 w-4" />
                                        </Button>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>

            <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
                <DialogContent className="max-w-2xl">
                    <DialogHeader>
                        <DialogTitle>{selectedProduct.id ? 'Edit Package' : 'Create Package'}</DialogTitle>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Package Name</Label>
                                <Input value={selectedProduct.name || ''} onChange={e => setSelectedProduct({ ...selectedProduct, name: e.target.value })} />
                            </div>
                            <div className="space-y-2">
                                <Label>Monthly Price ($)</Label>
                                <Input type="number" value={selectedProduct.price || ''} onChange={e => setSelectedProduct({ ...selectedProduct, price: parseFloat(e.target.value) })} />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label>Description</Label>
                            <Textarea value={selectedProduct.description || ''} onChange={e => setSelectedProduct({ ...selectedProduct, description: e.target.value })} />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>AI Token Limit</Label>
                                <Input type="number" value={selectedProduct.ai_tokens || ''} onChange={e => setSelectedProduct({ ...selectedProduct, ai_tokens: parseInt(e.target.value) })} />
                            </div>
                            <div className="flex items-center space-x-2 pt-8">
                                <Switch checked={selectedProduct.isPublic} onCheckedChange={c => setSelectedProduct({ ...selectedProduct, isPublic: c })} />
                                <Label>Publicly Visible</Label>
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label>Features (Comma separated)</Label>
                            <Textarea
                                value={selectedProduct.features?.join(', ') || ''}
                                onChange={e => setSelectedProduct({ ...selectedProduct, features: e.target.value.split(',').map(s => s.trim()) })}
                                placeholder="5 Users, Priority Support, 10GB Storage"
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsEditOpen(false)}>Cancel</Button>
                        <Button onClick={handleSave}>Save & Sync to Stripe</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
};
