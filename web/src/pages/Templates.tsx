import React, { useState } from 'react'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ScrollArea } from '@/components/ui/scroll-area'
import { 
  FileText, 
  Download, 
  Eye, 
  Edit, 
  Trash2, 
  Plus,
  Search,
  Star,
  Clock,
  Users,
  Copy,
  Upload,
  Settings,
  Grid,
  List
} from 'lucide-react'

interface Template {
  id: string
  name: string
  description: string
  category: string
  fields: number
  uses: number
  lastModified: string
  rating: number
  isFavorite: boolean
}

const mockTemplates: Template[] = [
  {
    id: '1',
    name: 'Invoice Template',
    description: 'Standard invoice template with automatic calculations',
    category: 'Finance',
    fields: 15,
    uses: 234,
    lastModified: '2024-01-15',
    rating: 4.8,
    isFavorite: true
  },
  {
    id: '2',
    name: 'Tax Form 1040',
    description: 'US federal income tax return form',
    category: 'Tax',
    fields: 42,
    uses: 189,
    lastModified: '2024-01-10',
    rating: 4.6,
    isFavorite: false
  },
  {
    id: '3',
    name: 'Employment Contract',
    description: 'Standard employment agreement with terms and conditions',
    category: 'Legal',
    fields: 28,
    uses: 156,
    lastModified: '2024-01-08',
    rating: 4.7,
    isFavorite: true
  },
  {
    id: '4',
    name: 'Medical History Form',
    description: 'Patient medical history and information form',
    category: 'Medical',
    fields: 35,
    uses: 98,
    lastModified: '2024-01-05',
    rating: 4.5,
    isFavorite: false
  },
  {
    id: '5',
    name: 'Purchase Order',
    description: 'Business purchase order with item details and pricing',
    category: 'Finance',
    fields: 20,
    uses: 145,
    lastModified: '2024-01-03',
    rating: 4.9,
    isFavorite: true
  },
  {
    id: '6',
    name: 'Application Form',
    description: 'General purpose application form template',
    category: 'General',
    fields: 18,
    uses: 267,
    lastModified: '2023-12-28',
    rating: 4.4,
    isFavorite: false
  }
]

const categories = ['All', 'Finance', 'Tax', 'Legal', 'Medical', 'General']

export default function Templates() {
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('All')
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')
  const [templates, setTemplates] = useState(mockTemplates)

  const filteredTemplates = templates.filter(template => {
    const matchesSearch = template.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         template.description.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesCategory = selectedCategory === 'All' || template.category === selectedCategory
    return matchesSearch && matchesCategory
  })

  const toggleFavorite = (id: string) => {
    setTemplates(prev => prev.map(t => 
      t.id === id ? { ...t, isFavorite: !t.isFavorite } : t
    ))
  }

  const TemplateCard = ({ template }: { template: Template }) => (
    <Card className="h-full flex flex-col">
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <CardTitle className="text-lg">{template.name}</CardTitle>
            <div className="flex items-center gap-2">
              <Badge variant="secondary">{template.category}</Badge>
              <div className="flex items-center gap-1">
                <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                <span className="text-xs text-muted-foreground">{template.rating}</span>
              </div>
            </div>
          </div>
          <Button
            size="icon"
            variant="ghost"
            onClick={() => toggleFavorite(template.id)}
          >
            <Star className={`h-4 w-4 ${template.isFavorite ? 'fill-yellow-400 text-yellow-400' : ''}`} />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="flex-1">
        <p className="text-sm text-muted-foreground mb-4">{template.description}</p>
        <div className="space-y-2 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Fields:</span>
            <span className="font-medium">{template.fields}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Uses:</span>
            <span className="font-medium">{template.uses}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Modified:</span>
            <span className="font-medium">{template.lastModified}</span>
          </div>
        </div>
      </CardContent>
      <CardFooter className="pt-4">
        <div className="flex gap-2 w-full">
          <Button variant="outline" size="sm" className="flex-1">
            <Eye className="mr-2 h-3 w-3" />
            Preview
          </Button>
          <Button size="sm" className="flex-1">
            <FileText className="mr-2 h-3 w-3" />
            Use
          </Button>
        </div>
      </CardFooter>
    </Card>
  )

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight">Templates</h1>
        <p className="text-muted-foreground">
          Pre-configured templates for common document types
        </p>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Templates</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">24</div>
            <p className="text-xs text-muted-foreground">6 categories</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Uses</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">1,234</div>
            <p className="text-xs text-muted-foreground">+12% this month</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Most Popular</CardTitle>
            <Star className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-lg font-bold">Invoice Template</div>
            <p className="text-xs text-muted-foreground">234 uses</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Recently Added</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-lg font-bold">W-9 Tax Form</div>
            <p className="text-xs text-muted-foreground">Added 2 days ago</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters and Actions */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <CardTitle>Template Library</CardTitle>
              <CardDescription>Browse and manage your document templates</CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="icon" 
                onClick={() => setViewMode(viewMode === 'grid' ? 'list' : 'grid')}>
                {viewMode === 'grid' ? <List className="h-4 w-4" /> : <Grid className="h-4 w-4" />}
              </Button>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                New Template
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* Search and Category Tabs */}
            <div className="flex gap-4">
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search templates..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-8"
                  />
                </div>
              </div>
            </div>

            <Tabs defaultValue="All" value={selectedCategory} onValueChange={setSelectedCategory}>
              <TabsList className="grid w-full grid-cols-6">
                {categories.map(category => (
                  <TabsTrigger key={category} value={category}>
                    {category}
                  </TabsTrigger>
                ))}
              </TabsList>
              <TabsContent value={selectedCategory} className="mt-4">
                {viewMode === 'grid' ? (
                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {filteredTemplates.map(template => (
                      <TemplateCard key={template.id} template={template} />
                    ))}
                  </div>
                ) : (
                  <div className="space-y-2">
                    {filteredTemplates.map(template => (
                      <Card key={template.id}>
                        <CardContent className="flex items-center justify-between p-4">
                          <div className="flex items-center gap-4">
                            <FileText className="h-8 w-8 text-muted-foreground" />
                            <div>
                              <div className="flex items-center gap-2">
                                <h3 className="font-semibold">{template.name}</h3>
                                <Badge variant="secondary">{template.category}</Badge>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="h-6 w-6"
                                  onClick={() => toggleFavorite(template.id)}
                                >
                                  <Star className={`h-3 w-3 ${template.isFavorite ? 'fill-yellow-400 text-yellow-400' : ''}`} />
                                </Button>
                              </div>
                              <p className="text-sm text-muted-foreground">{template.description}</p>
                              <div className="flex items-center gap-4 mt-1 text-xs text-muted-foreground">
                                <span>{template.fields} fields</span>
                                <span>{template.uses} uses</span>
                                <span>Modified {template.lastModified}</span>
                                <div className="flex items-center gap-1">
                                  <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                                  <span>{template.rating}</span>
                                </div>
                              </div>
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <Button size="sm" variant="outline">
                              <Eye className="mr-2 h-3 w-3" />
                              Preview
                            </Button>
                            <Button size="sm">
                              <FileText className="mr-2 h-3 w-3" />
                              Use Template
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}