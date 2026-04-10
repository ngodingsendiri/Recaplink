import React, { useState, useEffect } from 'react';
import { db } from '../lib/firebase';
import { collection, addDoc, onSnapshot, query, orderBy, deleteDoc, doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { Employee } from '../types';
import { Button, buttonVariants } from './ui/button';
import { Input } from './ui/input';
import { Badge } from './ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from './ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { Trash2, Plus, UserPlus, Save, X, Download, Upload, FileSpreadsheet, Users, Instagram, Facebook, User, CreditCard, AtSign, UserCircle } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from './FirebaseProvider';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '@/lib/utils';
import { auth } from '../lib/firebase';

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
    tenantId: string | null | undefined;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  toast.error(`Gagal: ${errInfo.error}`);
  throw new Error(JSON.stringify(errInfo));
}

export default function EmployeeManager() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [isAdding, setIsAdding] = useState(false);
  const [formData, setFormData] = useState({ name: '', nip: '', bidang: '', igUsername: '', fbName: '' });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const { user, loading } = useAuth();

  useEffect(() => {
    if (loading || !user) {
      setEmployees([]);
      return;
    }

    const q = query(collection(db, 'employees'), orderBy('createdAt', 'asc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const emps = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Employee));
      setEmployees(emps);
    }, (error) => {
      console.error("Firestore Error:", error);
      if (user) {
        toast.error("Gagal memuat data pegawai");
      }
    });
    return unsubscribe;
  }, [user, loading]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.nip) {
      toast.error("Nama dan NIP wajib diisi");
      return;
    }

    try {
      if (editingId) {
        await updateDoc(doc(db, 'employees', editingId), {
          ...formData,
          updatedAt: serverTimestamp()
        });
        toast.success("Data pegawai diperbarui");
      } else {
        await addDoc(collection(db, 'employees'), {
          ...formData,
          createdAt: serverTimestamp()
        });
        toast.success("Pegawai ditambahkan");
      }
      resetForm();
    } catch (error) {
      handleFirestoreError(error, editingId ? OperationType.UPDATE : OperationType.CREATE, 'employees');
    }
  };

  const resetForm = () => {
    setFormData({ name: '', nip: '', bidang: '', igUsername: '', fbName: '' });
    setIsAdding(false);
    setEditingId(null);
  };

  const confirmDelete = (id: string) => {
    setDeleteConfirmId(id);
  };

  const executeDelete = async () => {
    if (!deleteConfirmId) return;
    try {
      await deleteDoc(doc(db, 'employees', deleteConfirmId));
      toast.success("Pegawai dihapus");
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, 'employees');
    } finally {
      setDeleteConfirmId(null);
    }
  };

  const cancelDelete = () => {
    setDeleteConfirmId(null);
  };

  const startEdit = (emp: Employee) => {
    setFormData({ 
      name: emp.name, 
      nip: emp.nip, 
      bidang: emp.bidang || '',
      igUsername: emp.igUsername || '', 
      fbName: emp.fbName || '' 
    });
    setEditingId(emp.id);
    setIsAdding(true);
  };

  const downloadTemplate = () => {
    // Create Excel Template
    const templateData = [
      { 
        'Nama Lengkap': 'Dr. John Doe, M.Sc.', 
        'NIP': '198XXXXXXXXXXXXX', 
        'Bidang / Unit Kerja': 'Bidang Aspirasi', 
        'Username Instagram': '@username', 
        'Nama Profil Facebook': 'Nama Facebook' 
      }
    ];

    const worksheet = XLSX.utils.json_to_sheet(templateData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Template Pegawai");
    
    // Generate buffer and download
    XLSX.writeFile(workbook, "template_pegawai.xlsx");
    toast.success("Template Excel berhasil didownload");
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const fileExtension = file.name.split('.').pop()?.toLowerCase();
    setIsUploading(true);

    if (fileExtension === 'csv') {
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: async (results) => {
          await processUploadedData(results.data);
          e.target.value = '';
        },
        error: (error) => {
          setIsUploading(false);
          toast.error("Gagal membaca file CSV");
        }
      });
    } else if (fileExtension === 'xlsx' || fileExtension === 'xls') {
      const reader = new FileReader();
      reader.onload = async (evt) => {
        try {
          const data = evt.target?.result;
          const wb = XLSX.read(data, { type: 'array' });
          const wsname = wb.SheetNames[0];
          const ws = wb.Sheets[wsname];
          const jsonData = XLSX.utils.sheet_to_json(ws);
          await processUploadedData(jsonData);
        } catch (err) {
          console.error("Excel parse error:", err);
          setIsUploading(false);
          toast.error("Gagal membaca file Excel");
        }
        e.target.value = '';
      };
      reader.readAsArrayBuffer(file);
    } else {
      setIsUploading(false);
      toast.error("Format file tidak didukung. Gunakan .csv, .xlsx, atau .xls");
    }
  };

  const processUploadedData = async (data: any[]) => {
    if (!auth.currentUser) {
      toast.error("Anda harus login untuk mengupload data");
      return;
    }

    let successCount = 0;
    setIsUploading(true);
    
    try {
      const { writeBatch } = await import('firebase/firestore');
      
      // Split into chunks of 500 (Firestore batch limit)
      const chunks = [];
      for (let i = 0; i < data.length; i += 500) {
        chunks.push(data.slice(i, i + 500));
      }

      for (const chunk of chunks) {
        const batch = writeBatch(db);
        const employeesRef = collection(db, 'employees');
        let chunkCount = 0;

        for (const row of chunk) {
          // Map potential column names (Indonesian/English)
          const name = row.name || row['Nama Lengkap'] || row['Nama'];
          const nip = row.nip || row['NIP'] || row['Nomor Induk Pegawai'];
          const bidang = row.bidang || row['Bidang / Unit Kerja'] || row['Bidang'] || row['Unit Kerja'];
          const igUsername = row.igUsername || row['Username Instagram'] || row['Instagram'];
          const fbName = row.fbName || row['Nama Profil Facebook'] || row['Facebook'];

          if (name && nip) {
            const newDocRef = doc(employeesRef);
            batch.set(newDocRef, {
              name: String(name),
              nip: String(nip),
              bidang: bidang ? String(bidang) : '',
              igUsername: igUsername ? String(igUsername) : '',
              fbName: fbName ? String(fbName) : '',
              createdAt: serverTimestamp()
            });
            chunkCount++;
            successCount++;
          }
        }

        if (chunkCount > 0) {
          console.log(`Committing batch chunk with ${chunkCount} operations...`);
          await batch.commit();
        }
      }

      if (successCount > 0) {
        toast.success(`${successCount} pegawai berhasil diupload`);
      } else {
        toast.error("Tidak ada data valid yang ditemukan di file");
      }
    } catch (err) {
      console.error("Batch upload error details:", err);
      handleFirestoreError(err, OperationType.WRITE, 'employees');
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="space-y-6 md:space-y-8">
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
        <div className="space-y-0.5">
          <h2 className="text-xl font-bold tracking-tight text-slate-900">Database Pegawai</h2>
          <p className="text-slate-500 text-xs">Kelola data pegawai untuk monitoring engagement kolektif</p>
        </div>
        <div className="flex flex-wrap gap-2 w-full lg:w-auto">
          <Button variant="outline" size="sm" onClick={downloadTemplate} className="flex-1 md:flex-none gap-2 rounded-xl border-slate-200 hover:bg-slate-50 text-slate-600 h-11 px-4 text-xs font-bold">
            <FileSpreadsheet size={14} className="text-emerald-600" />
            Template Excel
          </Button>
          <div className="relative flex-1 md:flex-none">
            <Input 
              type="file" 
              accept=".csv, .xlsx, .xls" 
              className="hidden" 
              id="excel-upload" 
              onChange={handleFileUpload}
              disabled={isUploading}
            />
            <label 
              htmlFor="excel-upload" 
              className={cn(
                buttonVariants({ variant: "outline", size: "sm" }),
                "w-full rounded-xl border-slate-200 hover:bg-slate-50 text-slate-600 cursor-pointer gap-2 flex items-center justify-center h-11 px-4 text-xs font-bold",
                isUploading && "opacity-50 pointer-events-none"
              )}
            >
              <Upload size={14} className="text-indigo-600" />
              {isUploading ? 'Uploading...' : 'Impor Excel/CSV'}
            </label>
          </div>
          {!isAdding && (
            <Button size="sm" onClick={() => setIsAdding(true)} className="w-full md:w-auto gap-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white shadow-md h-11 px-6 text-xs font-bold border-none">
              <UserPlus size={14} />
              Tambah Pegawai
            </Button>
          )}
        </div>
      </div>

      <AnimatePresence>
        {isAdding && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="overflow-hidden"
          >
            <Card className="rounded-2xl border-slate-100 shadow-lg overflow-hidden bg-white">
              <CardHeader className="bg-slate-50/50 border-b border-slate-100 p-6">
                <div className="flex justify-between items-center">
                  <div>
                    <CardTitle className="text-lg font-bold flex items-center gap-2">
                      {editingId ? <Save className="w-4 h-4" /> : <UserPlus className="w-4 h-4" />}
                      {editingId ? 'Edit Data Pegawai' : 'Tambah Pegawai Baru'}
                    </CardTitle>
                    <p className="text-slate-500 text-xs mt-0.5">Lengkapi informasi pegawai di bawah ini</p>
                  </div>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    onClick={resetForm} 
                    className="rounded-full hover:bg-slate-100 text-slate-400 h-8 w-8"
                  >
                    <X size={18} />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="p-6">
                <form onSubmit={handleSubmit} className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider ml-1">Nama Lengkap</label>
                      <div className="relative group">
                        <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-slate-900 transition-colors">
                          <User size={14} />
                        </div>
                        <Input 
                          placeholder="Ahmad Subarjo" 
                          value={formData.name}
                          onChange={(e) => setFormData({...formData, name: e.target.value})}
                          className="rounded-xl bg-white border-slate-200 focus:ring-slate-900 h-10 pl-10 text-sm"
                        />
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider ml-1">NIP</label>
                      <div className="relative group">
                        <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-slate-900 transition-colors">
                          <CreditCard size={14} />
                        </div>
                        <Input 
                          placeholder="18 digit NIP" 
                          value={formData.nip}
                          onChange={(e) => setFormData({...formData, nip: e.target.value})}
                          className="rounded-xl bg-white border-slate-200 focus:ring-slate-900 h-10 pl-10 text-sm"
                        />
                      </div>
                    </div>
                    <div className="space-y-1.5 md:col-span-2">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider ml-1">Bidang / Unit Kerja</label>
                      <div className="relative group">
                        <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-slate-900 transition-colors">
                          <Users size={14} />
                        </div>
                        <Input 
                          placeholder="Contoh: Bidang Aspirasi" 
                          value={formData.bidang}
                          onChange={(e) => setFormData({...formData, bidang: e.target.value})}
                          className="rounded-xl bg-white border-slate-200 focus:ring-slate-900 h-10 pl-10 text-sm"
                        />
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider ml-1">Instagram</label>
                      <div className="relative group">
                        <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-pink-500 transition-colors">
                          <Instagram size={14} />
                        </div>
                        <Input 
                          placeholder="@username" 
                          value={formData.igUsername}
                          onChange={(e) => setFormData({...formData, igUsername: e.target.value})}
                          className="rounded-xl bg-white border-slate-200 focus:ring-slate-900 h-10 pl-10 text-sm"
                        />
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider ml-1">Facebook</label>
                      <div className="relative group">
                        <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-500 transition-colors">
                          <Facebook size={14} />
                        </div>
                        <Input 
                          placeholder="Nama Profil FB" 
                          value={formData.fbName}
                          onChange={(e) => setFormData({...formData, fbName: e.target.value})}
                          className="rounded-xl bg-white border-slate-200 focus:ring-slate-900 h-10 pl-10 text-sm"
                        />
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-col sm:flex-row justify-end gap-3 pt-4 border-t border-slate-50">
                    <Button 
                      type="button" 
                      variant="ghost" 
                      onClick={resetForm} 
                      className="w-full sm:w-auto rounded-lg px-6 font-semibold text-slate-500 hover:bg-slate-50 h-10 text-sm"
                    >
                      Batal
                    </Button>
                    <Button 
                      type="submit" 
                      className="w-full sm:w-auto rounded-lg px-8 bg-indigo-600 hover:bg-indigo-700 text-white h-10 font-bold shadow-md transition-all active:scale-95 flex items-center justify-center gap-2 text-sm border-none"
                    >
                      <Save size={16} />
                      {editingId ? 'Simpan Perubahan' : 'Simpan Pegawai'}
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      <Card className="rounded-2xl border-slate-100 shadow-sm overflow-hidden bg-white">
        <CardContent className="p-0">
          <div className="overflow-x-auto overflow-y-auto max-h-[600px]">
            <div className="min-w-[800px]">
              <Table>
                <TableHeader className="bg-slate-50/50 sticky top-0 z-10 shadow-sm">
                  <TableRow className="hover:bg-transparent border-slate-100">
                    <TableHead className="pl-6 py-4 font-bold text-slate-400 uppercase tracking-widest text-[10px] bg-slate-50/90 backdrop-blur-sm">Pegawai</TableHead>
                    <TableHead className="font-bold text-slate-400 uppercase tracking-widest text-[10px] bg-slate-50/90 backdrop-blur-sm">Bidang</TableHead>
                    <TableHead className="font-bold text-slate-400 uppercase tracking-widest text-[10px] bg-slate-50/90 backdrop-blur-sm">Identitas</TableHead>
                    <TableHead className="font-bold text-slate-400 uppercase tracking-widest text-[10px] bg-slate-50/90 backdrop-blur-sm">Sosial Media</TableHead>
                    <TableHead className="text-right pr-6 font-bold text-slate-400 uppercase tracking-widest text-[10px] bg-slate-50/90 backdrop-blur-sm">Aksi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {employees.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="h-48 text-center text-slate-400">
                        <div className="flex flex-col items-center gap-2">
                          <Users size={24} className="opacity-20" />
                          <p className="text-xs font-medium">Belum ada data pegawai</p>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : (
                    employees.map((emp) => (
                      <TableRow key={emp.id} className="group hover:bg-slate-50/30 transition-all border-slate-50">
                        <TableCell className="pl-6 py-3">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-slate-600 font-bold text-xs">
                              {emp.name.charAt(0)}
                            </div>
                            <div className="font-bold text-slate-900 text-sm">{emp.name}</div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="bg-white text-slate-500 border-slate-200 rounded-md px-2 py-0 text-[9px] font-bold uppercase tracking-wider">
                            {emp.bidang || 'N/A'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <code className="text-[10px] bg-slate-50 px-2 py-0.5 rounded border border-slate-100 text-slate-500 font-mono">{emp.nip}</code>
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-3">
                            <div className="flex items-center gap-1.5 text-[10px] font-medium text-slate-500">
                              <Instagram size={12} className={emp.igUsername ? "text-pink-500" : "text-slate-300"} />
                              {emp.igUsername || '-'}
                            </div>
                            <div className="flex items-center gap-1.5 text-[10px] font-medium text-slate-500">
                              <Facebook size={12} className={emp.fbName ? "text-blue-500" : "text-slate-300"} />
                              {emp.fbName || '-'}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="text-right pr-6">
                          <div className="flex justify-end gap-1">
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              onClick={() => startEdit(emp)} 
                              className="h-8 w-8 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-900 transition-all"
                              title="Edit"
                            >
                              <UserCircle size={14} />
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              onClick={() => confirmDelete(emp.id)} 
                              className="h-8 w-8 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-600 transition-all"
                              title="Hapus"
                            >
                              <Trash2 size={14} />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {deleteConfirmId && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="bg-white w-full max-w-sm rounded-2xl shadow-2xl overflow-hidden"
            >
              <div className="p-6 text-center space-y-4">
                <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-2">
                  <Trash2 size={28} className="text-red-500" />
                </div>
                <h3 className="text-lg font-bold text-slate-900">Hapus Pegawai?</h3>
                <p className="text-xs text-slate-500">
                  Tindakan ini tidak dapat dibatalkan. Data pegawai akan dihapus secara permanen dari sistem.
                </p>
              </div>
              <div className="p-4 bg-slate-50/50 border-t border-slate-100 flex gap-3">
                <Button variant="outline" onClick={cancelDelete} className="flex-1 font-bold text-xs rounded-xl h-11 border-slate-200">
                  Batal
                </Button>
                <Button onClick={executeDelete} className="flex-1 bg-red-600 hover:bg-red-700 text-white font-bold text-xs rounded-xl h-11 shadow-lg shadow-red-100 border-none">
                  Hapus
                </Button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
