use tab_organizer::Database;
use wasm_bindgen::intern;


const LATEST_VERSION: u32 = 1;


pub(crate) fn migrate(db: &Database) {
    let version: u32 = db.get_or_insert(intern("version"), || LATEST_VERSION);

    if version != LATEST_VERSION {

    }
}
