namespace Cavex.Principal.Models.EmpEmpleado
{
    /// <summary>
    /// Representa el archivo PDF recibido desde la API después de validar que la respuesta
    /// contiene datos binarios, un tipo de contenido permitido y un nombre de archivo seguro.
    /// </summary>
    /// <remarks>
    /// El contenido se conserva como bytes porque un PDF no es un documento JSON y, por tanto,
    /// no debe pasar por el serializador utilizado para los DTO habituales de la aplicación.
    /// </remarks>
    public sealed class EmpleadoPdfFileResult
    {
        /// <summary>
        /// Obtiene los bytes exactos del PDF que el controlador MVC reenviará al navegador.
        /// </summary>
        public byte[] Content { get; init; } = [];

        /// <summary>
        /// Obtiene el tipo MIME validado que permite al navegador seleccionar su visor de PDF.
        /// </summary>
        public string ContentType { get; init; } = "application/pdf";

        /// <summary>
        /// Obtiene un nombre saneado, sin rutas ni caracteres capaces de alterar las cabeceras HTTP.
        /// </summary>
        public string FileName { get; init; } = "Empleado.pdf";
    }
}
