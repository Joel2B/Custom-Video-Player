import is from './is';

/**
 * Returns the extension of the passed file name. It will return an empty string
 * if passed an invalid path.
 *
 * @function
 * @param    {string} path
 *           The fileName path like '/path/to/file.mp4'
 *
 * @return  {string}
 *           The extension in lower case or an empty string if no
 *           extension could be found.
 */
export const getFileExtension = function(path) {
    if (!is.string(path)) {
        return '';
    }

    const ext = path.split('.').pop();

    return ext === path ? '' : ext.toLowerCase();
};
