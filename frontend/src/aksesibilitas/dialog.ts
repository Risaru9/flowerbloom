import { buatToko, useToko } from '@/lib/toko-kecil'

const tokoDialog = buatToko(false)

export const bukaDialogAksesibilitas = () => tokoDialog.atur(true)
export const tutupDialogAksesibilitas = () => tokoDialog.atur(false)
export const useDialogAksesibilitasTerbuka = () => useToko(tokoDialog)
